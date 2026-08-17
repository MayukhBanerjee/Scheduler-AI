"""
backend/matching.py
Service matching engine — filters and ranks services based on user intent
"""

import re
from typing import List, Dict, Optional, Set, Tuple
from datetime import datetime, date, timedelta


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

WEEKDAY_NAMES = [
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"
]

STATIC_DAY_MAP = {
    "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
    "friday": 4, "saturday": 5, "sunday": 6,
}

TIME_PERIOD_MAP = {
    "morning": ("08:00", "12:00"),
    "afternoon": ("12:00", "17:00"),
    "evening": ("17:00", "21:00"),
    "night": ("18:00", "22:00"),
}


def get_day_map() -> Dict[str, int]:
    """Per-request day map so today/tomorrow stay accurate across midnight."""
    today = date.today()
    return {
        **STATIC_DAY_MAP,
        "today": today.weekday(),
        "tomorrow": (today.weekday() + 1) % 7,
    }


def resolve_iso_date(date_str: Optional[str]) -> Optional[str]:
    """Normalize relative day names to YYYY-MM-DD when possible."""
    if not date_str:
        return None
    s = date_str.strip().lower()
    if re.match(r"^\d{4}-\d{2}-\d{2}$", s):
        return s
    today = date.today()
    if s == "today":
        return today.strftime("%Y-%m-%d")
    if s == "tomorrow":
        return (today + timedelta(days=1)).strftime("%Y-%m-%d")
    if s in STATIC_DAY_MAP:
        target = STATIC_DAY_MAP[s]
        delta = (target - today.weekday()) % 7
        if delta == 0:
            delta = 7
        return (today + timedelta(days=delta)).strftime("%Y-%m-%d")
    return date_str


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


def extract_search_tags(service_type: Optional[str], specific_service: Optional[str]) -> List[str]:
    """Expand user intent into a full flat list of searchable tags."""
    text = " ".join(filter(None, [service_type, specific_service])).lower().strip()
    if not text:
        return []

    tags: Set[str] = set()

    for word in re.split(r"\s+", text):
        if len(word) >= 3:
            tags.add(word)

    for _category, keywords in CATEGORY_MAP.items():
        score = sum(1 for kw in keywords if kw in text)
        if score > 0:
            tags.update(kw.lower() for kw in keywords)

    return sorted(tags)


def parse_time_preference(time_str: Optional[str]) -> Optional[Tuple[str, str]]:
    """Convert natural language time to (start, end) tuple."""
    if not time_str:
        return None
    t = time_str.lower().strip()
    for period, bounds in TIME_PERIOD_MAP.items():
        if period in t:
            return bounds
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
    day_map = get_day_map()
    for day in day_map:
        if day in t:
            return day
    return None


def filter_by_availability(
    providers: List[Dict],
    time_str: Optional[str],
    date_str: Optional[str] = None,
) -> List[Tuple[Dict, List[str]]]:
    """
    Returns list of (provider, matching_slots) pairs.
    Providers with no matching slots for a requested date/day are omitted.
    """
    time_bounds = parse_time_preference(time_str)
    iso_date = resolve_iso_date(date_str)

    day_key = get_day_key(time_str) or get_day_key(date_str)

    if iso_date and re.match(r"^\d{4}-\d{2}-\d{2}$", iso_date):
        try:
            dt = datetime.strptime(iso_date, "%Y-%m-%d")
            day_key = WEEKDAY_NAMES[dt.weekday()]
        except ValueError:
            pass

    date_or_day_requested = bool(iso_date or day_key or date_str)
    result = []

    for provider in providers:
        availability: Dict[str, List[str]] = provider.get("availability", {}) or {}

        if iso_date and iso_date in availability:
            slots = list(availability[iso_date] or [])
        elif day_key and day_key in availability:
            slots = list(availability[day_key] or [])
        elif date_or_day_requested:
            continue
        else:
            slots = []
            for day_slots in availability.values():
                if isinstance(day_slots, list):
                    slots.extend(day_slots)
            slots = sorted(set(slots))

        if time_bounds and slots:
            start_t, end_t = time_bounds
            slots = [s for s in slots if start_t <= s <= end_t]

        if date_or_day_requested and not slots:
            continue

        result.append((provider, slots[:5]))

    return result


def _earliest_slot_minutes(slots: List[str]) -> int:
    if not slots:
        return 24 * 60
    best = 24 * 60
    for s in slots:
        try:
            h, m = s.split(":")
            best = min(best, int(h) * 60 + int(m))
        except (ValueError, AttributeError):
            continue
    return best


def rank_results(
    services: List[Dict],
    providers: List[Dict],
    intent: Dict,
    filtered_availability: Dict[str, List[str]],
    priorities: Optional[List[str]] = None,
) -> List[Dict]:
    """
    Rank service results using goal priorities / urgency.
    Providers with zero slots are excluded when a date was requested.
    """
    provider_name_pref = (intent.get("provider_name") or "").lower()
    date_requested = bool(intent.get("date"))
    priorities = priorities or ["rating", "availability", "price"]
    scored = []

    for service in services:
        pid = str(service.get("provider_id", ""))
        provider = next((p for p in providers if str(p.get("_id", "")) == pid), None)
        if not provider:
            continue

        slots = filtered_availability.get(pid, [])
        if date_requested and not slots:
            continue

        score = 0.0
        if provider_name_pref and provider_name_pref in provider.get("name", "").lower():
            score += 10.0

        rating = float(provider.get("rating", 3.0))
        price = float(service.get("price", 0) or 0)
        slot_count = len(slots)
        earliest = _earliest_slot_minutes(slots)

        for i, pri in enumerate(priorities):
            weight = max(3 - i, 1)
            if pri == "rating":
                score += rating * weight
            elif pri == "availability":
                score += min(slot_count, 5) * 0.5 * weight
            elif pri == "earliest_slot":
                score += max(0, (24 * 60 - earliest) / 60) * 0.3 * weight
            elif pri == "price":
                score += max(0, 100 - min(price, 100)) * 0.01 * weight

        score += rating + min(slot_count, 5) * 0.25

        scored.append((score, service, provider, slots))

    scored.sort(key=lambda x: x[0], reverse=True)

    resolved_date = resolve_iso_date(intent.get("date"))

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
            "date": resolved_date or intent.get("date"),
        }
        for score, s, p, slots in scored[:5]
    ]
