import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

// ─── POST /api/bookings ────────────────────────────────────────────────────────
// Creates a booking. Calls the create_booking_safe RPC for atomic slot removal.
export async function POST(req: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session || session.role !== "user") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { service_id, provider_id, date, time, duration_minutes, service_name } = body;

    if (!service_id || !provider_id || !date || !time) {
      return NextResponse.json(
        { error: "service_id, provider_id, date, and time are required" },
        { status: 400 }
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
    }

    // Resolve provider_id: may be a UUID (new) or legacy ObjectId string.
    // Try to find by id first, then by user_id for legacy compat.
    let providerProfileId: string = provider_id;

    const { data: providerByProfileId } = await supabaseAdmin
      .from("provider_profiles")
      .select("id, business_name, location, user_id")
      .eq("id", provider_id)
      .maybeSingle();

    // If not found by profile id, try finding by user_id (migration compat)
    let provider = providerByProfileId;
    if (!provider) {
      const { data: providerByUserId } = await supabaseAdmin
        .from("provider_profiles")
        .select("id, business_name, location, user_id")
        .eq("user_id", provider_id)
        .maybeSingle();
      provider = providerByUserId;
      if (provider) providerProfileId = provider.id;
    }

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    // Resolve service: try by UUID, then by legacy_id
    let resolvedService: {
      id: string; name: string; price: number; duration_minutes: number;
    } | null = null;

    const { data: svcById } = await supabaseAdmin
      .from("services")
      .select("id, name, price, duration_minutes")
      .eq("id", service_id)
      .eq("provider_id", providerProfileId)
      .maybeSingle();

    resolvedService = svcById;

    if (!resolvedService) {
      const { data: svcByLegacy } = await supabaseAdmin
        .from("services")
        .select("id, name, price, duration_minutes")
        .eq("legacy_id", service_id)
        .maybeSingle();
      resolvedService = svcByLegacy;
    }

    // Check the requested slot is available
    const { data: slots } = await supabaseAdmin
      .rpc("get_available_slots", {
        p_provider_profile_id: providerProfileId,
        p_date: date,
      });

    const requestedTime = time.substring(0, 5); // normalize "09:00:00" → "09:00"
    const slotAvailable = slots?.some(
      (s: { slot_time: string; is_available: boolean }) =>
        s.slot_time.substring(0, 5) === requestedTime && s.is_available
    );

    if (!slotAvailable) {
      return NextResponse.json(
        { error: "That time slot is no longer available" },
        { status: 409 }
      );
    }

    // Fetch user info for denormalized fields
    const { data: userRow } = await supabaseAdmin
      .from("users")
      .select("name, email")
      .eq("id", session.userId)
      .single();

    // Get provider email
    const { data: providerUserRow } = await supabaseAdmin
      .from("users")
      .select("email")
      .eq("id", provider.user_id)
      .single();

    const durationMin = duration_minutes ||
      resolvedService?.duration_minutes || 60;
    const price = resolvedService?.price ?? 0;
    const finalServiceName = resolvedService?.name || service_name || "Service";

    // Call atomic RPC — handles conflict check + slot removal in one transaction
    const { data: bookingId, error: rpcError } = await supabaseAdmin
      .rpc("create_booking_safe", {
        p_user_id: session.userId,
        p_provider_id: providerProfileId,
        p_service_id: resolvedService?.id ?? null,
        p_date: date,
        p_start_time: requestedTime,
        p_service_name: finalServiceName,
        p_provider_name: provider.business_name,
        p_provider_email: providerUserRow?.email ?? "",
        p_user_email: session.email,
        p_user_name: userRow?.name ?? session.email,
        p_location: provider.location ?? "",
        p_price: price,
        p_duration_minutes: durationMin,
      });

    if (rpcError) {
      if (rpcError.message?.includes("SLOT_TAKEN")) {
        return NextResponse.json({ error: "This slot is already booked" }, { status: 409 });
      }
      throw new Error(rpcError.message);
    }

    return NextResponse.json({
      success: true,
      booking_id: bookingId,
      booking: {
        service_name: finalServiceName,
        provider_name: provider.business_name,
        location: provider.location,
        date,
        time: requestedTime,
        status: "confirmed",
      },
    });
  } catch (error) {
    console.error("[bookings POST] error:", error);
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
  }
}

// ─── GET /api/bookings ─────────────────────────────────────────────────────────
export async function GET(req: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (session.role !== "user") {
      return NextResponse.json(
        { error: "Only customer accounts can view bookings this way" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");

    let query = supabaseAdmin
      .from("bookings")
      .select("*")
      .eq("user_id", session.userId)
      .order("date", { ascending: false })
      .order("start_time", { ascending: false })
      .limit(50);

    if (statusFilter) {
      query = query.eq("status", statusFilter);
    }

    const { data: bookings, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      bookings: (bookings ?? []).map((b) => ({
        ...b,
        _id: b.id,
        time: b.start_time?.substring(0, 5),
      })),
    });
  } catch (error) {
    console.error("[bookings GET] error:", error);
    return NextResponse.json({ error: "Failed to fetch bookings" }, { status: 500 });
  }
}
