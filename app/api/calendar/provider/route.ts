import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const session = await getSessionFromCookies();
    if (!session || session.role !== "provider") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date().toISOString().split("T")[0];

    // Get provider profile id from user id
    const { data: profile } = await supabaseAdmin
      .from("provider_profiles")
      .select("id")
      .eq("user_id", session.userId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Provider profile not found" }, { status: 404 });
    }

    const { data: bookings, error } = await supabaseAdmin
      .from("bookings")
      .select("id, service_name, date, start_time, location, user_name")
      .eq("provider_id", profile.id)
      .gte("date", today)
      .neq("status", "cancelled")
      .order("date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(30);

    if (error) throw error;

    return NextResponse.json({
      events: (bookings ?? []).map((b) => ({
        id: b.id,
        service_name: b.service_name || "Client Booking",
        date: b.date,
        time: b.start_time?.substring(0, 5),
        location: b.location || null,
        user_name: b.user_name || null,
      })),
    });
  } catch (error) {
    console.error("[calendar/provider] GET error:", error);
    return NextResponse.json({ error: "Failed to fetch calendar data" }, { status: 500 });
  }
}