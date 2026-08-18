"""
backend/database.py
Async Supabase query helpers — replaces MongoDB motor client.
Author: Mayukh Banerjee

All functions mirror the original MongoDB signatures so agent.py
and matching.py require NO changes — only this file changes.
"""

import os
import re
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv

load_dotenv()

# Lazy-initialized Supabase client
_supabase = None


def get_supabase():
    global _supabase
    if _supabase is None:
        from supabase import create_client
        url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
        key = (
            os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            or os.getenv("SUPABASE_KEY")
            or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
        )
        if not url or not key:
            raise RuntimeError(
                "SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY must be set in backend/.env"
            )
        _supabase = create_client(url, key)
    return _supabase


# ─── Service Queries ──────────────────────────────────────────────────────────

async def find_services(query: Dict[str, Any], limit: int = 20) -> List[Dict]:
    """Fetch active services, optionally filtered by category."""
    sb = get_supabase()
    q = sb.from_("service_catalog").select("*").limit(limit)

    if query.get("category"):
        q = q.eq("category", query["category"])

    result = q.execute()
    rows = result.data or []
    # Normalize to match old MongoDB document shape
    return [_normalize_service(r) for r in rows]


async def find_providers(query: Dict[str, Any], limit: int = 20) -> List[Dict]:
    """Fetch providers, optionally filtered by category."""
    sb = get_supabase()
    q = (
        sb.from_("provider_discovery")
        .select("*")
        .order("rating", desc=True)
        .limit(limit)
    )
    if query.get("category"):
        q = q.eq("category", query["category"])

    result = q.execute()
    return [_normalize_provider(r) for r in (result.data or [])]


async def find_providers_by_tags(
    tags: List[str],
    category: Optional[str] = None,
    location_lower: Optional[str] = None,
    provider_name: Optional[str] = None,
    limit: int = 30,
) -> List[Dict]:
    """
    Primary agent retrieval path — mirrors MongoDB find_providers_by_tags().
    Calls the search_providers_by_tags() PostgreSQL RPC function which uses
    the GIN-indexed provider_search_tags table.
    """
    sb = get_supabase()

    # Tier 1: Exact search with tags, category, and specific location
    result = sb.rpc(
        "search_providers_by_tags",
        {
            "p_tags": tags,
            "p_category": category,
            "p_location_like": location_lower,
            "p_provider_name": provider_name,
            "p_limit": limit,
        },
    ).execute()

    providers = result.data or []

    # Tier 2: If 0 results and location was specified, expand search city-wide (drop location constraint)
    if not providers and location_lower:
        result_citywide = sb.rpc(
            "search_providers_by_tags",
            {
                "p_tags": tags,
                "p_category": category,
                "p_location_like": None,
                "p_provider_name": provider_name,
                "p_limit": limit,
            },
        ).execute()
        providers = result_citywide.data or []

    # Tier 3: If still 0 results and category is known, fetch top providers in that category
    if not providers and category:
        result_cat = sb.rpc(
            "search_providers_by_tags",
            {
                "p_tags": [],
                "p_category": category,
                "p_location_like": None,
                "p_provider_name": provider_name,
                "p_limit": limit,
            },
        ).execute()
        providers = result_cat.data or []

    # For each provider, fetch their embedded services so the agent can expand them
    enriched = []
    for p in providers:
        svc_result = (
            sb.from_("services")
            .select("id, name, category, description, price, duration_minutes, legacy_id, service_tags(tag)")
            .eq("provider_id", p["provider_id"])
            .eq("is_active", True)
            .order("sort_order")
            .execute()
        )
        services = []
        for s in (svc_result.data or []):
            tags_list = [t["tag"] for t in (s.get("service_tags") or [])]
            services.append({
                "id": s.get("legacy_id") or s["id"],
                "name": s["name"],
                "price": s["price"],
                "duration_minutes": s["duration_minutes"],
                "description": s.get("description", ""),
                "tags": tags_list,
            })

        # Also fetch availability slots
        av_result = (
            sb.from_("availability_slots")
            .select("day_of_week, specific_date, start_time, is_booked")
            .eq("provider_id", p["provider_id"])
            .eq("is_booked", False)
            .execute()
        )
        availability: Dict[str, List[str]] = {}
        for slot in (av_result.data or []):
            key = slot.get("specific_date") or slot.get("day_of_week") or "unknown"
            t = slot["start_time"]
            if isinstance(t, str):
                t = t[:5]  # "09:00:00" -> "09:00"
            if key not in availability:
                availability[key] = []
            availability[key].append(t)

        enriched.append({
            "_id": p["provider_id"],          # agent uses _id to match providers
            "name": p["business_name"],
            "ownerName": p.get("owner_name", ""),
            "email": p.get("email", ""),
            "category": p["category"],
            "location": p.get("location", ""),
            "location_lower": p.get("location", "").lower(),
            "description": p.get("description", ""),
            "rating": float(p.get("rating", 5.0)),
            "is_verified": p.get("is_verified", False),
            "search_tags": p.get("search_tags") or [],
            "services": services,
            "availability": availability,
            "role": "provider",
        })

    return enriched


async def get_provider_by_id(provider_id: str) -> Optional[Dict]:
    """Fetch a single provider by their provider_profiles.id UUID."""
    sb = get_supabase()
    result = (
        sb.from_("provider_discovery")
        .select("*")
        .eq("provider_id", provider_id)
        .maybe_single()
        .execute()
    )
    if not result.data:
        return None
    return _normalize_provider(result.data)


async def get_service_by_id(service_id: str) -> Optional[Dict]:
    """Fetch a service by UUID or legacy_id."""
    sb = get_supabase()

    # Try UUID first
    result = sb.from_("services").select("*, service_tags(tag)").eq("id", service_id).maybe_single().execute()
    if not result.data:
        # Try legacy_id
        result = sb.from_("services").select("*, service_tags(tag)").eq("legacy_id", service_id).maybe_single().execute()
    if not result.data:
        return None
    return _normalize_service(result.data)


async def create_booking(booking_data: Dict) -> str:
    """
    Create a booking directly. Prefer create_booking_safe RPC from the Next.js layer.
    This function is a fallback for Python-initiated bookings.
    """
    sb = get_supabase()
    result = sb.from_("bookings").insert(booking_data).select("id").single().execute()
    return result.data["id"]


async def update_booking(booking_id: str, update_data: Dict) -> bool:
    sb = get_supabase()
    result = (
        sb.from_("bookings")
        .update(update_data)
        .eq("id", booking_id)
        .execute()
    )
    return len(result.data or []) > 0


async def find_bookings(query: Dict, limit: int = 50) -> List[Dict]:
    sb = get_supabase()
    q = sb.from_("bookings").select("*").order("date", desc=True).limit(limit)

    if "user_id" in query:
        q = q.eq("user_id", query["user_id"])
    if "provider_id" in query:
        q = q.eq("provider_id", query["provider_id"])
    if "status" in query:
        q = q.eq("status", query["status"])

    result = q.execute()
    rows = result.data or []
    return [
        {**r, "_id": r["id"], "time": (r.get("start_time") or "")[:5]}
        for r in rows
    ]


# ─── Normalization helpers ────────────────────────────────────────────────────

def _normalize_provider(p: Dict) -> Dict:
    return {
        "_id": p.get("provider_id") or p.get("id", ""),
        "name": p.get("name") or p.get("business_name", ""),
        "ownerName": p.get("owner_name", ""),
        "email": p.get("email", ""),
        "category": p.get("category", ""),
        "location": p.get("location", ""),
        "location_lower": p.get("location", "").lower(),
        "description": p.get("description", ""),
        "rating": float(p.get("rating", 5.0)),
        "is_verified": p.get("is_verified", False),
        "search_tags": p.get("search_tags") or [],
        "services": [],
        "availability": {},
        "role": "provider",
    }


def _normalize_service(s: Dict) -> Dict:
    tags = [t["tag"] for t in (s.get("service_tags") or [])]
    return {
        "_id": s.get("legacy_id") or s.get("id", ""),
        "provider_id": s.get("provider_id", ""),
        "name": s.get("name", ""),
        "category": s.get("category", ""),
        "description": s.get("description", ""),
        "price": float(s.get("price", 0)),
        "duration_minutes": s.get("duration_minutes", 60),
        "tags": tags,
    }