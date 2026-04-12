"""
backend/seed_db.py
Seeds MongoDB with sample service providers (embedded services config) and demo users.
Run: python seed_db.py
"""

import asyncio
import os
from datetime import datetime
import bcrypt
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from bson import ObjectId

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("MONGODB_DB_NAME", "scheduleai")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


SERVICE_PROVIDERS = [
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
            }
        ],
        "availability": {
            "monday": ["09:00", "10:30", "12:00", "14:00", "16:00"],
            "tuesday": ["09:00", "11:00", "13:00", "15:00"],
            "wednesday": ["10:00", "12:00", "14:00", "17:00"],
            "thursday": ["09:00", "11:00", "13:30", "15:30"],
            "friday": ["09:00", "10:30", "14:00", "16:00"],
            "saturday": ["10:00", "12:00", "14:00"],
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
                "tags": ["checkup", "cleaning", "teeth", "dentist"],
            },
            {
                "name": "Teeth Whitening",
                "price": 3500,
                "duration_minutes": 90,
                "description": "Professional in-office teeth whitening treatment.",
                "tags": ["whitening", "teeth", "smile"],
            }
        ],
        "availability": {
            "monday": ["09:30", "11:00", "14:00", "16:00"],
            "tuesday": ["10:00", "12:00", "15:00"],
            "wednesday": ["09:30", "11:00", "14:30", "16:30"],
            "thursday": ["10:00", "13:00", "15:30"],
            "friday": ["09:30", "11:30", "14:00"],
            "saturday": ["10:00", "12:00"],
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
                "tags": ["massage", "swedish", "relaxation", "spa"],
            },
            {
                "name": "Deep Tissue Massage",
                "price": 1800,
                "duration_minutes": 90,
                "description": "Targeted deep tissue massage for muscle tension and recovery.",
                "tags": ["massage", "therapy", "pain relief"],
            }
        ],
        "availability": {
            "tuesday": ["11:00", "13:00", "15:00", "17:00"],
            "wednesday": ["10:00", "12:00", "14:00", "16:00"],
            "thursday": ["11:00", "13:00", "15:30"],
            "friday": ["10:00", "12:00", "14:00", "16:30"],
            "saturday": ["09:00", "11:00", "13:00", "15:00"],
            "sunday": ["10:00", "12:00", "14:00"],
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
                "tags": ["training", "gym", "workout", "strength"],
            },
            {
                "name": "Yoga Class",
                "price": 600,
                "duration_minutes": 60,
                "description": "Guided yoga session for flexibility and mindfulness.",
                "tags": ["yoga", "flexibility", "wellness"],
            }
        ],
        "availability": {
            "monday": ["06:00", "07:00", "08:00", "17:00", "18:00", "19:00"],
            "tuesday": ["06:00", "07:30", "17:00", "18:30"],
            "wednesday": ["06:00", "07:00", "08:00", "18:00", "19:00"],
            "thursday": ["06:30", "08:00", "17:00", "18:30"],
            "friday": ["06:00", "07:30", "17:30", "19:00"],
            "saturday": ["07:00", "08:30", "10:00"],
        },
        "rating": 4.6,
        "role": "provider",
        "createdAt": datetime.utcnow(),
    },
]


async def seed():
    client = AsyncIOMotorClient(MONGODB_URI)
    db = client[DB_NAME]

    print(f"🌱 Seeding database: {DB_NAME} at {MONGODB_URI}")

    # Drop existing collections completely. `services` collection is now legacy/fully deprecated.
    for col in ["service_providers", "services", "users", "bookings"]:
        await db[col].drop()
        print(f"  🗑  Dropped '{col}' collection")

    # Insert providers containing embedded sub-services array natively!
    await db["service_providers"].insert_many(SERVICE_PROVIDERS)
    print(f"  ✅ Inserted {len(SERVICE_PROVIDERS)} service providers (with embedded sub-services)")

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

    # Create indexes - Embed the tag search into the service_providers collection explicitly!
    await db["service_providers"].create_index([("category", 1)])
    await db["service_providers"].create_index([("email", 1)], unique=True)
    await db["service_providers"].create_index([("services.tags", 1)])
    await db["service_providers"].create_index([("services.name", 1)])
    
    await db["users"].create_index([("email", 1)], unique=True)
    await db["bookings"].create_index([("user_id", 1)])
    await db["bookings"].create_index([("provider_id", 1)])
    print("  ✅ Created indexes")

    client.close()
    print("\n🎉 Database seeded successfully!")
    print("  Customer: demo@scheduleai.com / demo1234")
    print("  Provider: thestylestudio@demo.com / demo1234")
    print("  Provider: citydentalclinic@demo.com / demo1234")


if __name__ == "__main__":
    asyncio.run(seed())
