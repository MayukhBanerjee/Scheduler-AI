import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const session = await getSessionFromCookies();
    if (!session || session.role !== "user") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date().toISOString().split("T")[0];

    const { data: bookings, error } = await supabaseAdmin
      .from("bookings")
      .select("id, service_name, date, start_time, location, provider_name")
      .eq("user_id", session.userId)
      .gte("date", today)
      .neq("status", "cancelled")
      .order("date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(20);

    if (error) throw error;

    return NextResponse.json({
      events: (bookings ?? []).map((b) => ({
        id: b.id,
        service_name: b.service_name || "Appointment",
        date: b.date,
        time: b.start_time?.substring(0, 5),
        location: b.location || null,
        provider_name: b.provider_name || null,
      })),
    });
  } catch (error) {
    console.error("[calendar/user] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch calendar data" }, { status: 500 });
  }
}