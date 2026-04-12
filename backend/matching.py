"""
backend/matching.py
Service matching engine — filters and ranks services based on user intent
"""

import re
from typing import List, Dict, Optional, Tuple
from datetime import datetime, date


# Category keyword map for intent → category matching
CATEGORY_MAP = {
    "Beauty & Hair": [
        "hair", "haircut", "salon", "trim", "style", "blowout", "color",
        "highlights", "barber", "beauty", "nail", "manicure", "pedicure"
    ],
    "Healthcare": [
        "doctor", "physician", "checkup", "medical", "health", "clinic",
        "gp", "general practitioner", "prescription", "consultation doctor"
    ],
    "Wellness & Spa": [
        "massage", "spa", "relaxation", "facial", "skincare", "therapy",
        "stress", "wellness", "body", "aromatherapy", "hot stone"
    ],
    "Fitness": [
        "gym", "workout", "training", "personal trainer", "yoga", "pilates",
        "fitness", "exercise", "crossfit", "strength", "cardio"
    ],
    "Dental": [
        "dental", "dentist", "teeth", "tooth", "cavity", "cleaning",
        "orthodontist", "braces", "whitening", "root canal"
    ],
    "Legal": [
        "lawyer", "legal", "attorney", "law", "contract", "advice legal",
        "consultation legal", "litigation"
    ],
    "Consulting": [
        "consulting", "consultant", "business", "strategy", "advice",
        "audit", "planning", "review", "meeting"
    ],
    "Education": [
        "tutor", "tutoring", "learn", "class", "lesson", "coach",
        "teaching", "study", "academic"
    ],
    "Home Services": [
        "plumber", "electrician", "repair", "cleaning home", "pest",
        "handyman", "maid", "painting home", "carpenter"
    ],
}

# Day name to weekday index
DAY_MAP = {
    "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
    "friday": 4, "saturday": 5, "sunday": 6,
    "today": date.today().weekday(),
    "tomorrow": (date.today().weekday() + 1) % 7,
}

TIME_PERIOD_MAP = {
    "morning": ("08:00", "12:00"),
    "afternoon": ("12:00", "17:00"),
    "evening": ("17:00", "21:00"),
    "night": ("18:00", "22:00"),
}


def infer_category(service_type: Optional[str], specific_service: Optional[str]) -> Optional[str]:
    """Map extracted intent to service category."""
    text = " ".join(filter(None, [service_type, specific_service])).lower()
    if not text:
        return None

    best_match = None
    best_score = 0
    for category, keywords in CATEGORY_MAP.items():
        score = sum(1 for kw in keywords if kw in text)
        if score > best_score:
            best_score = score
            best_match = category

    return best_match if best_score > 0 else None


def parse_time_preference(time_str: Optional[str]) -> Optional[Tuple[str, str]]:
    """Convert natural language time to (start, end) tuple."""
    if not time_str:
        return None
    t = time_str.lower().strip()
    # Check time period keywords
    for period, bounds in TIME_PERIOD_MAP.items():
        if period in t:
            return bounds
    # Try HH:MM pattern
    match = re.search(r"(\d{1,2}):?(\d{2})?\s*(am|pm)?", t)
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2) or "0")
        meridiem = match.group(3)
        if meridiem == "pm" and hour != 12:
            hour += 12
        elif meridiem == "am" and hour == 12:
            hour = 0
        time_val = f"{hour:02d}:{minute:02d}"
        end_hour = min(hour + 2, 23)
        return (time_val, f"{end_hour:02d}:{minute:02d}")
    return None


def get_day_key(time_str: Optional[str]) -> Optional[str]:
    """Extract day of week key from intent."""
    if not time_str:
        return None
    t = time_str.lower()
    for day, _ in DAY_MAP.items():
        if day in t:
            return day
    return None


def filter_by_availability(
    providers: List[Dict],
    time_str: Optional[str],
) -> List[Tuple[Dict, List[str]]]:
    """
    Returns list of (provider, matching_slots) pairs.
    Each provider has an `availability` dict keyed by day name.
    """
    time_bounds = parse_time_preference(time_str)
    day_key = get_day_key(time_str)

    result = []
    for provider in providers:
        availability: Dict[str, List[str]] = provider.get("availability", {})

        if day_key and day_key in availability:
            slots = availability[day_key]
        elif day_key:
            # day requested but no slots for that day
            continue
        else:
            # No day preference — collect all slots
            slots = []
            for day_slots in availability.values():
                slots.extend(day_slots)
            slots = list(set(slots))
            slots.sort()

        # Filter by time bounds
        if time_bounds and slots:
            start_t, end_t = time_bounds
            slots = [s for s in slots if start_t <= s <= end_t]

        result.append((provider, slots[:5]))  # Max 5 slots shown

    return result


def rank_results(
    services: List[Dict],
    providers: List[Dict],
    intent: Dict,
    filtered_availability: Dict[str, List[str]],
) -> List[Dict]:
    """
    Rank service results by:
    1. Provider name match (if specified)
    2. Number of available slots
    3. Provider rating
    4. Category relevance
    """
    provider_name_pref = (intent.get("provider_name") or "").lower()
    scored = []

    for service in services:
        pid = str(service.get("provider_id", ""))
        provider = next((p for p in providers if str(p.get("_id", "")) == pid), None)
        if not provider:
            continue

        slots = filtered_availability.get(pid, [])
        # Relaxed constraint: display matching providers even if they haven't set up specific slot hours yet (ideal for newly registered providers)

        score = 0.0
        # Provider name match
        if provider_name_pref and provider_name_pref in provider.get("name", "").lower():
            score += 10.0
        # Rating (max 5)
        score += provider.get("rating", 3.0)
        # Slot count (more = better availability)
        score += min(len(slots), 5) * 0.5

        scored.append((score, service, provider, slots))

    scored.sort(key=lambda x: x[0], reverse=True)

    return [
        {
            "service_id": str(s.get("_id", "")),
            "service_name": s.get("name", ""),
            "category": s.get("category", ""),
            "provider_id": str(p.get("_id", "")),
            "provider_name": p.get("name", ""),
            "provider_email": p.get("email", ""),
            "location": p.get("location", ""),
            "price": s.get("price", 0),
            "duration_minutes": s.get("duration_minutes", 60),
            "available_slots": slots,
            "rating": p.get("rating", 4.0),
            "description": s.get("description", ""),
            "tags": s.get("tags", []),
        }
        for score, s, p, slots in scored[:5]  # Top 5 results
    ]
