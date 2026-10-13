import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session || session.role !== "user") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    let query = supabaseAdmin
      .from("bookings")
      .select("id, service_name, date, start_time, duration_minutes, location, provider_name, status, price")
      .eq("user_id", session.userId)
      .neq("status", "cancelled")
      .order("date", { ascending: true })
      .order("start_time", { ascending: true });

    if (startDate) {
      query = query.gte("date", startDate);
    }
    if (endDate) {
      query = query.lte("date", endDate);
    } else if (!startDate) {
      query = query.limit(50);
    }

    const { data: bookings, error } = await query;

    if (error) throw error;

    return NextResponse.json({
      events: (bookings ?? []).map((b) => ({
        id: b.id,
        service_name: b.service_name || "Appointment",
        date: b.date,
        time: b.start_time?.substring(0, 5),
        duration_minutes: b.duration_minutes || 60,
        price: b.price || 0,
        status: b.status || "confirmed",
        location: b.location || null,
        provider_name: b.provider_name || null,
      })),
    });
  } catch (error) {
    console.error("[calendar/user] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch calendar data" }, { status: 500 });
  }
}