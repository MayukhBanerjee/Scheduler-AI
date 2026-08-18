import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await req.json();
    const action = body?.action as string;

    if (action !== "cancel" && action !== "complete") {
      return NextResponse.json(
        { error: "action must be 'cancel' or 'complete'" },
        { status: 400 }
      );
    }

    const { data: booking, error: fetchErr } = await supabaseAdmin
      .from("bookings")
      .select("id, user_id, provider_id, status, date, start_time")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr || !booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const { data: providerProfile } = await supabaseAdmin
      .from("provider_profiles")
      .select("user_id")
      .eq("id", booking.provider_id)
      .maybeSingle();

    const isOwner = session.role === "user" && booking.user_id === session.userId;
    const isProvider =
      session.role === "provider" &&
      providerProfile?.user_id === session.userId;

    if (!isOwner && !isProvider) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (action === "complete" && !isProvider) {
      return NextResponse.json(
        { error: "Only providers can mark bookings complete" },
        { status: 403 }
      );
    }

    if (booking.status === "cancelled") {
      return NextResponse.json({ error: "Booking is already cancelled" }, { status: 400 });
    }
    if (action === "complete" && booking.status === "completed") {
      return NextResponse.json({ error: "Booking is already completed" }, { status: 400 });
    }

    if (action === "cancel") {
      const { data: newStatus, error: rpcError } = await supabaseAdmin
        .rpc("cancel_booking_safe", {
          p_booking_id: id,
          p_actor_id: session.userId,
        });
      if (rpcError) throw new Error(rpcError.message);
      return NextResponse.json({ success: true, status: newStatus });
    }

    const { error: updateErr } = await supabaseAdmin
      .from("bookings")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", id);

    if (updateErr) throw updateErr;
    return NextResponse.json({ success: true, status: "completed" });
  } catch (error) {
    console.error("[bookings PATCH] error:", error);
    return NextResponse.json({ error: "Failed to update booking" }, { status: 500 });
  }
}