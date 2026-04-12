import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function GET(req: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session || session.role !== "provider") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();
    const provider = await db.collection("service_providers").findOne({ _id: new ObjectId(session.userId) });

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    return NextResponse.json({ provider });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch profile" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session || session.role !== "provider") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, category, location, rating, services } = body;

    const db = await getDb();
    const result = await db.collection("service_providers").updateOne(
      { _id: new ObjectId(session.userId) },
      {
        $set: {
          name,
          category,
          location,
          rating: rating ?? 5.0, // Providers can fake/manage their own state per requirement
          services: Array.isArray(services) ? services : [],
        },
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Profile updated securely!" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update profile" }, { status: 500 });
  }
}
