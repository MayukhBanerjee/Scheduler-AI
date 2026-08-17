import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const session = await getSessionFromCookies();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid booking id" }, { status: 400 });
    }

    const body = await req.json();
    const action = body?.action as string;

    if (action !== "cancel" && action !== "complete") {
      return NextResponse.json(
        { error: "action must be 'cancel' or 'complete'" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const booking = await db.collection("bookings").findOne({ _id: new ObjectId(id) });
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const userId = session.userId;
    const isOwner =
      session.role === "user" && booking.user_id?.toString() === userId;
    const isProvider =
      session.role === "provider" && booking.provider_id?.toString() === userId;

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

    const newStatus = action === "cancel" ? "cancelled" : "completed";

    await db.collection("bookings").updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: newStatus, updated_at: new Date() } }
    );

    // Restore slot on cancel
    if (action === "cancel" && booking.provider_id && booking.date && booking.time) {
      const provider = await db.collection("service_providers").findOne({
        _id: new ObjectId(booking.provider_id.toString()),
      });
      if (provider) {
        const availability = {
          ...((provider.availability || {}) as Record<string, string[]>),
        };
        const dateKey = String(booking.date);
        const current = Array.isArray(availability[dateKey])
          ? [...availability[dateKey]]
          : [];
        if (!current.includes(booking.time)) {
          current.push(booking.time);
          current.sort();
        }
        availability[dateKey] = current;
        await db.collection("service_providers").updateOne(
          { _id: provider._id },
          { $set: { availability } }
        );
      }
    }

    return NextResponse.json({ success: true, status: newStatus });
  } catch (error) {
    console.error("[bookings PATCH] error:", error);
    return NextResponse.json({ error: "Failed to update booking" }, { status: 500 });
  }
}
