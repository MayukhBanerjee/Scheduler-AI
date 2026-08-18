"""
backend/seed_db.py
Seeds Supabase with sample service providers, services, availability slots, and demo users.
Author: Mayukh Banerjee

Run: python seed_db.py
"""

import os
import sys
import bcrypt
from dotenv import load_dotenv

# Force UTF-8 output
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(12)).decode()


CATEGORY_TAG_MAP = {
    "Beauty & Hair": [
        "hair", "haircut", "salon", "trim", "style", "blowout", "color",
        "highlights", "barber", "beauty", "nail", "manicure", "pedicure",
    ],
    "Healthcare": [
        "doctor", "physician", "checkup", "medical", "health", "clinic",
        "gp", "general practitioner", "prescription", "consultation",
    ],
    "Wellness & Spa": [
        "massage", "spa", "relaxation", "facial", "skincare", "therapy",
        "stress", "wellness", "body", "aromatherapy", "hot stone",
    ],
    "Fitness": [
        "gym", "workout", "training", "personal trainer", "yoga", "pilates",
        "fitness", "exercise", "crossfit", "strength", "cardio",
    ],
    "Dental": [
        "dental", "dentist", "teeth", "tooth", "cavity", "cleaning",
        "orthodontist", "braces", "whitening", "root canal",
    ],
    "Legal": [
        "lawyer", "legal", "attorney", "law", "contract", "advice",
        "consultation", "litigation",
    ],
    "Consulting": [
        "consulting", "consultant", "business", "strategy", "advice",
        "audit", "planning", "review", "meeting",
    ],
    "Education": [
        "tutor", "tutoring", "learn", "class", "lesson", "coach",
        "teaching", "study", "academic",
    ],
    "Home Services": [
        "plumber", "electrician", "repair", "cleaning", "pest",
        "handyman", "maid", "painting", "carpenter",
    ],
}


def compute_search_tags(category: str, services: list) -> list:
    STOP_WORDS = {"with", "and", "for", "the", "your", "from", "this", "that"}
    tags = set()
    tags.update(t.lower() for t in CATEGORY_TAG_MAP.get(category, []))
    for svc in services:
        for tag in svc.get("tags", []):
            tags.add(tag.lower().strip())
        for word in svc.get("name", "").lower().split():
            if len(word) >= 4 and word not in STOP_WORDS:
                tags.add(word)
    return sorted(tags)


DEMO_DATA = [
    {
        "user_id": "b0000000-0000-0000-0000-000000000001",
        "profile_id": "c0000000-0000-0000-0000-000000000001",
        "name": "The Style Studio",
        "ownerName": "Priya Sharma",
        "email": "thestylestudio@demo.com",
        "category": "Beauty & Hair",
        "location": "Koramangala, Bangalore",
        "description": "Premium hair salon focusing on advanced coloring, highlighting, and bespoke makeovers.",
        "rating": 4.9,
        "services": [
            {
                "id": "d0000000-0000-0000-0000-000000000001",
                "name": "Hair Cut & Style",
                "price": 800,
                "duration_minutes": 60,
                "description": "Professional haircut and styling tailored to your face shape.",
                "tags": ["haircut", "styling", "hair", "beauty", "salon"],
            },
            {
                "id": "d0000000-0000-0000-0000-000000000002",
                "name": "Hair Color & Highlights",
                "price": 2500,
                "duration_minutes": 120,
                "description": "Full hair coloring or highlights using premium products.",
                "tags": ["color", "highlights", "salon", "hair"],
            },
        ],
        "availability": {
            "monday":    ["09:00", "10:30", "12:00", "14:00", "16:00"],
            "tuesday":   ["09:00", "11:00", "13:00", "15:00"],
            "wednesday": ["10:00", "12:00", "14:00", "17:00"],
            "thursday":  ["09:00", "11:00", "13:30", "15:30"],
            "friday":    ["09:00", "10:30", "14:00", "16:00"],
            "saturday":  ["10:00", "12:00", "14:00"],
        },
    },
    {
        "user_id": "b0000000-0000-0000-0000-000000000002",
        "profile_id": "c0000000-0000-0000-0000-000000000002",
        "name": "City Dental Clinic",
        "ownerName": "Dr. Arun Mehta",
        "email": "citydentalclinic@demo.com",
        "category": "Dental",
        "location": "Indiranagar, Bangalore",
        "description": "Advanced dental clinic covering comprehensive oral hygiene, cavities, and aesthetic tooth care.",
        "rating": 4.8,
        "services": [
            {
                "id": "d0000000-0000-0000-0000-000000000003",
                "name": "Dental Checkup & Cleaning",
                "price": 600,
                "duration_minutes": 60,
                "description": "Full dental examination and professional teeth cleaning.",
                "tags": ["checkup", "cleaning", "teeth", "dentist", "dental"],
            },
            {
                "id": "d0000000-0000-0000-0000-000000000004",
                "name": "Teeth Whitening",
                "price": 3500,
                "duration_minutes": 90,
                "description": "Professional in-office teeth whitening treatment.",
                "tags": ["whitening", "teeth", "smile", "dental"],
            },
        ],
        "availability": {
            "monday":    ["09:30", "11:00", "14:00", "16:00"],
            "tuesday":   ["10:00", "12:00", "15:00"],
            "wednesday": ["09:30", "11:00", "14:30", "16:30"],
            "thursday":  ["10:00", "13:00", "15:30"],
            "friday":    ["09:30", "11:30", "14:00"],
            "saturday":  ["10:00", "12:00"],
        },
    },
    {
        "user_id": "b0000000-0000-0000-0000-000000000003",
        "profile_id": "c0000000-0000-0000-0000-000000000003",
        "name": "Serenity Spa & Wellness",
        "ownerName": "Kavya Nair",
        "email": "serenityspa@demo.com",
        "category": "Wellness & Spa",
        "location": "HSR Layout, Bangalore",
        "description": "A tranquil wellness center dedicated to ultimate body relaxation and deep tissue therapeutics.",
        "rating": 4.7,
        "services": [
            {
                "id": "d0000000-0000-0000-0000-000000000005",
                "name": "Swedish Massage",
                "price": 1200,
                "duration_minutes": 60,
                "description": "Relaxing full-body Swedish massage for stress relief.",
                "tags": ["massage", "swedish", "relaxation", "spa", "body"],
            },
            {
                "id": "d0000000-0000-0000-0000-000000000006",
                "name": "Deep Tissue Massage",
                "price": 1800,
                "duration_minutes": 90,
                "description": "Targeted deep tissue massage for muscle tension and recovery.",
                "tags": ["massage", "therapy", "pain relief", "deep tissue"],
            },
        ],
        "availability": {
            "tuesday":   ["11:00", "13:00", "15:00", "17:00"],
            "wednesday": ["10:00", "12:00", "14:00", "16:00"],
            "thursday":  ["11:00", "13:00", "15:30"],
            "friday":    ["10:00", "12:00", "14:00", "16:30"],
            "saturday":  ["09:00", "11:00", "13:00", "15:00"],
            "sunday":    ["10:00", "12:00", "14:00"],
        },
    },
    {
        "user_id": "b0000000-0000-0000-0000-000000000004",
        "profile_id": "c0000000-0000-0000-0000-000000000004",
        "name": "FitZone Personal Training",
        "ownerName": "Rahul Verma",
        "email": "fitzonetraining@demo.com",
        "category": "Fitness",
        "location": "Whitefield, Bangalore",
        "description": "One-on-one fitness regimens, strength coaching, and dedicated athletic training.",
        "rating": 4.6,
        "services": [
            {
                "id": "d0000000-0000-0000-0000-000000000007",
                "name": "Personal Training Session",
                "price": 1000,
                "duration_minutes": 60,
                "description": "Personalized coaching tailored to fitness goals.",
                "tags": ["training", "gym", "workout", "strength", "personal trainer"],
            },
            {
                "id": "d0000000-0000-0000-0000-000000000008",
                "name": "Yoga Class",
                "price": 600,
                "duration_minutes": 60,
                "description": "Guided yoga session for flexibility and mindfulness.",
                "tags": ["yoga", "flexibility", "wellness", "pilates"],
            },
        ],
        "availability": {
            "monday":    ["06:00", "07:00", "08:00", "17:00", "18:00", "19:00"],
            "tuesday":   ["06:00", "07:30", "17:00", "18:30"],
            "wednesday": ["06:00", "07:00", "08:00", "18:00", "19:00"],
            "thursday":  ["06:30", "08:00", "17:00", "18:30"],
            "friday":    ["06:00", "07:30", "17:30", "19:00"],
            "saturday":  ["07:00", "08:30", "10:00"],
        },
    },
]


def seed():
    from supabase import create_client

    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in backend/.env")
        return

    sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    print(f"🌱 Seeding Supabase database at {SUPABASE_URL}...")

    pw_hash = hash_password("demo1234")

    # 1. Insert demo user
    demo_user = {
        "id": "a0000000-0000-0000-0000-000000000001",
        "email": "demo@scheduleai.com",
        "name": "Demo User",
        "role": "user",
        "password_hash": pw_hash,
    }
    sb.from_("users").upsert(demo_user).execute()
    print("  ✅ Inserted demo user: demo@scheduleai.com (pw: demo1234)")

    # 2. Insert providers, profiles, services, tags, availability
    for p in DEMO_DATA:
        # User
        sb.from_("users").upsert({
            "id": p["user_id"],
            "email": p["email"],
            "name": p["name"],
            "role": "provider",
            "password_hash": pw_hash,
        }).execute()

        # Profile
        sb.from_("provider_profiles").upsert({
            "id": p["profile_id"],
            "user_id": p["user_id"],
            "business_name": p["name"],
            "owner_name": p["ownerName"],
            "category": p["category"],
            "location": p["location"],
            "description": p["description"],
            "rating": p["rating"],
            "is_verified": True,
        }).execute()

        # Search tags
        search_tags = compute_search_tags(p["category"], p["services"])
        tag_rows = [{"provider_id": p["profile_id"], "tag": tag} for tag in search_tags]
        if tag_rows:
            sb.from_("provider_search_tags").upsert(tag_rows, on_conflict="provider_id,tag").execute()

        # Services & service tags
        for i, svc in enumerate(p["services"]):
            legacy_id = f"{p['user_id']}:{i}"
            sb.from_("services").upsert({
                "id": svc["id"],
                "provider_id": p["profile_id"],
                "name": svc["name"],
                "category": p["category"],
                "description": svc["description"],
                "price": svc["price"],
                "duration_minutes": svc["duration_minutes"],
                "sort_order": i,
                "legacy_id": legacy_id,
                "is_active": True,
            }).execute()

            st_rows = [{"service_id": svc["id"], "tag": tag} for tag in svc.get("tags", [])]
            if st_rows:
                sb.from_("service_tags").upsert(st_rows, on_conflict="service_id,tag").execute()

        # Availability slots
        slot_rows = []
        for day, slots in p.get("availability", {}).items():
            for slot_time in slots:
                slot_rows.append({
                    "provider_id": p["profile_id"],
                    "day_of_week": day,
                    "start_time": slot_time,
                    "is_booked": False,
                })
        if slot_rows:
            sb.from_("availability_slots").insert(slot_rows).execute()

        print(f"  ✅ Inserted provider: {p['name']} ({p['email']})")

    print("\n🎉 Supabase database seeded successfully!")
    print("  Customer : demo@scheduleai.com / demo1234")
    for p in DEMO_DATA:
        print(f"  Provider : {p['email']} / demo1234")


if __name__ == "__main__":
    seed()