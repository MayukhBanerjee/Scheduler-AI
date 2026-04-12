import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export async function POST(req: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session || session.role !== "user") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { service_id, provider_id, date, time, duration_minutes, service_name, provider_email } = body;

    if (!service_id || !provider_id || !date || !time) {
      return NextResponse.json(
        { error: "service_id, provider_id, date, and time are required" },
        { status: 400 }
      );
    }

    const db = await getDb();

    // Create booking document
    const booking = {
      user_id: new ObjectId(session.userId),
      user_email: session.email,
      service_id: ObjectId.isValid(service_id) ? new ObjectId(service_id) : service_id,
      provider_id: ObjectId.isValid(provider_id) ? new ObjectId(provider_id) : provider_id,
      service_name: service_name || "Service",
      date,
      time,
      duration_minutes: duration_minutes || 60,
      status: "confirmed",
      google_event_id_user: null,
      google_event_id_provider: null,
      created_at: new Date(),
    };

    const result = await db.collection("bookings").insertOne(booking);
    const bookingId = result.insertedId.toString();

    return NextResponse.json({
      success: true,
      booking_id: bookingId,
    });
  } catch (error) {
    console.error("[bookings POST] error:", error);
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();
    const { searchParams } = new URL(req.url);

    let query: Record<string, unknown> = {};
    if (session.role === "user") {
      query = { user_id: new ObjectId(session.userId) };
    } else {
      // Provider sees their bookings
      const providerId = searchParams.get("provider_id") || session.userId;
      query = { provider_id: new ObjectId(providerId) };
    }

    const statusFilter = searchParams.get("status");
    if (statusFilter) {
      query.status = statusFilter;
    }

    const bookings = await db
      .collection("bookings")
      .find(query)
      .sort({ date: -1, time: -1 })
      .limit(50)
      .toArray();

    return NextResponse.json({
      bookings: bookings.map((b) => ({
        ...b,
        _id: b._id.toString(),
        user_id: b.user_id?.toString(),
        service_id: b.service_id?.toString(),
        provider_id: b.provider_id?.toString(),
      })),
    });
  } catch (error) {
    console.error("[bookings GET] error:", error);
    return NextResponse.json({ error: "Failed to fetch bookings" }, { status: 500 });
  }
}
