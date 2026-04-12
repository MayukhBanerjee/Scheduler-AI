import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function GET() {
  try {
    const session = await getSessionFromCookies();
    if (!session || session.role !== "user") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();
    const now = new Date();
    // Get today's date string YYYY-MM-DD
    const todayStr = now.toISOString().split("T")[0];

    const bookings = await db
      .collection("bookings")
      .find({
        user_id: new ObjectId(session.userId),
        date: { $gte: todayStr },
      })
      .sort({ date: 1, time: 1 })
      .limit(20)
      .toArray();

    return NextResponse.json({
      events: bookings.map((b) => ({
        id: b._id.toString(),
        service_name: b.service_name || "Appointment",
        date: b.date,
        time: b.time,
        location: b.location || null,
        provider_name: b.provider_name || null,
      })),
    });
  } catch (error) {
    console.error("[calendar/user] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch internal calendar data" }, { status: 500 });
  }
}
