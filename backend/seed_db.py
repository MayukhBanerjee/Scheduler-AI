"""
backend/seed_db.py
Seeds MongoDB with sample service providers (embedded services config) and demo users.

Schema changes:
  - `search_tags`   : flat, deduped, lowercase array at provider root (replaces buried services.tags index)
  - `location_lower`: lowercase location string for efficient case-insensitive prefix matching

Run: python seed_db.py
"""

import asyncio
import os
import sys
from datetime import datetime
from typing import List
import bcrypt
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from bson import ObjectId

# Force UTF-8 output so emoji print statements work on Windows terminals
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("MONGODB_DB_NAME", "scheduleai")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


# ─── Category keyword expansion map (mirrors matching.py CATEGORY_MAP) ────────
# Used to auto-expand search_tags on the provider root document.
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


def compute_search_tags(category: str, services: list) -> List[str]:
    """
    Build a flat, deduplicated, lowercase search_tags list for a provider.

    Sources (in priority order):
    1. All category-level keywords from CATEGORY_TAG_MAP
    2. All service-level tags from embedded services
    3. Meaningful words from service names (words >= 4 chars, excluding stop words)
    """
    STOP_WORDS = {"with", "and", "for", "the", "your", "from", "this", "that"}
    tags = set()

    # 1. Category-level keywords
    tags.update(t.lower() for t in CATEGORY_TAG_MAP.get(category, []))

    # 2. Per-service tags
    for svc in services:
        for tag in svc.get("tags", []):
            tags.add(tag.lower().strip())

        # 3. Meaningful words from service name
        for word in svc.get("name", "").lower().split():
            if len(word) >= 4 and word not in STOP_WORDS:
                tags.add(word)

    return sorted(tags)


# ─── Provider Documents ────────────────────────────────────────────────────────

def make_providers() -> list:
    """Build provider list with auto-computed search_tags and location_lower."""
    raw = [
        {
            "_id": ObjectId(),
            "name": "The Style Studio",
            "ownerName": "Priya Sharma",
            "email": "thestylestudio@demo.com",
            "passwordHash": hash_password("demo1234"),
            "category": "Beauty & Hair",
            "location": "Koramangala, Bangalore",
            "description": "Premium hair salon focusing on advanced coloring, highlighting, and bespoke makeovers.",
            "services": [
                {
                    "name": "Hair Cut & Style",
                    "price": 800,
                    "duration_minutes": 60,
                    "description": "Professional haircut and styling tailored to your face shape.",
                    "tags": ["haircut", "styling", "hair", "beauty", "salon"],
                },
                {
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
            "rating": 4.9,
            "role": "provider",
            "createdAt": datetime.utcnow(),
        },
        {
            "_id": ObjectId(),
            "name": "City Dental Clinic",
            "ownerName": "Dr. Arun Mehta",
            "email": "citydentalclinic@demo.com",
            "passwordHash": hash_password("demo1234"),
            "category": "Dental",
            "location": "Indiranagar, Bangalore",
            "description": "Advanced dental clinic covering comprehensive oral hygiene, cavities, and aesthetic tooth care.",
            "services": [
                {
                    "name": "Dental Checkup & Cleaning",
                    "price": 600,
                    "duration_minutes": 60,
                    "description": "Full dental examination and professional teeth cleaning.",
                    "tags": ["checkup", "cleaning", "teeth", "dentist", "dental"],
                },
                {
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
            "rating": 4.8,
            "role": "provider",
            "createdAt": datetime.utcnow(),
        },
        {
            "_id": ObjectId(),
            "name": "Serenity Spa & Wellness",
            "ownerName": "Kavya Nair",
            "email": "serenityspa@demo.com",
            "passwordHash": hash_password("demo1234"),
            "category": "Wellness & Spa",
            "location": "HSR Layout, Bangalore",
            "description": "A tranquil wellness center dedicated to ultimate body relaxation and deep tissue therapeutics.",
            "services": [
                {
                    "name": "Swedish Massage",
                    "price": 1200,
                    "duration_minutes": 60,
                    "description": "Relaxing full-body Swedish massage for stress relief.",
                    "tags": ["massage", "swedish", "relaxation", "spa", "body"],
                },
                {
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
            "rating": 4.7,
            "role": "provider",
            "createdAt": datetime.utcnow(),
        },
        {
            "_id": ObjectId(),
            "name": "FitZone Personal Training",
            "ownerName": "Rahul Verma",
            "email": "fitzonetraining@demo.com",
            "passwordHash": hash_password("demo1234"),
            "category": "Fitness",
            "location": "Whitefield, Bangalore",
            "description": "One-on-one fitness regimens, strength coaching, and dedicated athletic training.",
            "services": [
                {
                    "name": "Personal Training Session",
                    "price": 1000,
                    "duration_minutes": 60,
                    "description": "Personalized coaching tailored to fitness goals.",
                    "tags": ["training", "gym", "workout", "strength", "personal trainer"],
                },
                {
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
            "rating": 4.6,
            "role": "provider",
            "createdAt": datetime.utcnow(),
        },
    ]

    # Auto-compute search_tags and location_lower for each provider
    for p in raw:
        p["search_tags"] = compute_search_tags(p["category"], p["services"])
        p["location_lower"] = p["location"].lower()

    return raw


SERVICE_PROVIDERS = make_providers()


async def seed():
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[DB_NAME]

    print(f"🌱 Seeding database: {DB_NAME} at {MONGODB_URI}")

    # Drop existing collections
    for col in ["service_providers", "services", "users", "bookings"]:
        await db[col].drop()
        print(f"  🗑  Dropped '{col}' collection")

    # Insert providers with embedded services + denormalized search_tags
    await db["service_providers"].insert_many(SERVICE_PROVIDERS)
    print(f"  ✅ Inserted {len(SERVICE_PROVIDERS)} service providers (with search_tags)")

    # Preview tags for one provider
    for p in SERVICE_PROVIDERS[:1]:
        print(f"     Sample search_tags ({p['name']}): {p['search_tags']}")

    # Insert demo user
    demo_user = {
        "name": "Demo User",
        "email": "demo@scheduleai.com",
        "passwordHash": hash_password("demo1234"),
        "role": "user",
        "createdAt": datetime.utcnow(),
    }
    await db["users"].insert_one(demo_user)
    print("  ✅ Inserted demo user (email: demo@scheduleai.com, password: demo1234)")

    # ─── Indexes ────────────────────────────────────────────────────────────────
    #
    # search_tags  : flat array at root → multikey B-tree index, $in queries are
    #                fully index-covered. Replaces broken services.tags regex pattern.
    # location_lower: lowercase string → fast prefix/regex matches without $options:"i"
    # category     : equality filter used alongside search_tags for narrowing
    # email        : unique lookup for auth
    # rating       : for sort/filter by rating
    #
    await db["service_providers"].create_index([("search_tags", 1)])
    await db["service_providers"].create_index([("location_lower", 1)])
    await db["service_providers"].create_index([("category", 1)])
    await db["service_providers"].create_index([("rating", -1)])
    await db["service_providers"].create_index([("email", 1)], unique=True)

    # Compound: category + search_tags — covers the most common agent query pattern
    await db["service_providers"].create_index([("category", 1), ("search_tags", 1)])

    await db["users"].create_index([("email", 1)], unique=True)
    await db["bookings"].create_index([("user_id", 1)])
    await db["bookings"].create_index([("provider_id", 1)])
    await db["bookings"].create_index([("date", 1)])
    print("  ✅ Created optimized indexes")

    client.close()
    print("\n🎉 Database seeded successfully!")
    print("  Customer : demo@scheduleai.com / demo1234")
    print("  Provider : thestylestudio@demo.com / demo1234")
    print("  Provider : citydentalclinic@demo.com / demo1234")
    print("  Provider : serenityspa@demo.com / demo1234")
    print("  Provider : fitzonetraining@demo.com / demo1234")


if __name__ == "__main__":
    asyncio.run(seed())
