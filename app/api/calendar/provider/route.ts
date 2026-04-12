import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function GET() {
  try {
    const session = await getSessionFromCookies();
    if (!session || session.role !== "provider") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    const bookings = await db
      .collection("bookings")
      .find({
        provider_id: new ObjectId(session.userId),
        date: { $gte: todayStr },
      })
      .sort({ date: 1, time: 1 })
      .limit(30)
      .toArray();

    return NextResponse.json({
      events: bookings.map((b) => ({
        id: b._id.toString(),
        service_name: b.service_name || "Client Booking",
        date: b.date,
        time: b.time,
        location: b.location || null,
        user_name: b.user_name || null,
      })),
    });
  } catch (error) {
    console.error("[calendar/provider] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch internal calendar data" }, { status: 500 });
  }
}
