import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function resolveService(
  provider: { services?: Array<Record<string, unknown>>; _id: ObjectId },
  serviceId: string
) {
  const services = Array.isArray(provider.services) ? provider.services : [];
  const pid = provider._id.toString();

  // Prefer stable id field
  let idx = services.findIndex((s) => s?.id === serviceId);
  if (idx < 0 && serviceId.startsWith(`${pid}:`)) {
    const n = Number(serviceId.split(":")[1]);
    if (!Number.isNaN(n)) idx = n;
  }
  // Legacy embedded_{pid}_{i}
  if (idx < 0 && serviceId.startsWith("embedded_")) {
    const parts = serviceId.split("_");
    const n = Number(parts[parts.length - 1]);
    if (!Number.isNaN(n)) idx = n;
  }
  if (idx < 0 || idx >= services.length) return null;
  return { service: services[idx], index: idx };
}

function getSlotsForDate(
  availability: Record<string, string[]>,
  date: string
): { slots: string[]; sourceKey: string; fromWeekday: boolean } {
  if (availability[date] && Array.isArray(availability[date])) {
    return { slots: [...availability[date]], sourceKey: date, fromWeekday: false };
  }
  const d = new Date(`${date}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return { slots: [], sourceKey: date, fromWeekday: false };
  }
  const day = WEEKDAYS[d.getDay()];
  const weekdaySlots = availability[day];
  if (Array.isArray(weekdaySlots)) {
    return { slots: [...weekdaySlots], sourceKey: day, fromWeekday: true };
  }
  return { slots: [], sourceKey: day, fromWeekday: true };
}

async function ensureBookingIndexes(db: Awaited<ReturnType<typeof getDb>>) {
  try {
    await db.collection("bookings").createIndex(
      { provider_id: 1, date: 1, time: 1 },
      {
        unique: true,
        // Atlas/Mongo partial indexes do not support $ne — use $in instead
        partialFilterExpression: {
          status: { $in: ["confirmed", "pending", "completed"] },
        },
        name: "unique_active_provider_slot",
      }
    );
  } catch {
    // Index may already exist with different options — ignore
  }
}

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
      return NextResponse.json(
        { error: "date must be YYYY-MM-DD" },
        { status: 400 }
      );
    }

    if (!ObjectId.isValid(provider_id)) {
      return NextResponse.json({ error: "Invalid provider_id" }, { status: 400 });
    }

    const db = await getDb();
    await ensureBookingIndexes(db);

    const provider = await db.collection("service_providers").findOne({
      _id: new ObjectId(provider_id),
    });
    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    const resolved = resolveService(provider as { services?: Array<Record<string, unknown>>; _id: ObjectId }, service_id);
    const service = resolved?.service;
    const stableServiceId =
      (service?.id as string) ||
      (resolved ? `${provider_id}:${resolved.index}` : String(service_id));

    const availability = (provider.availability || {}) as Record<string, string[]>;
    const { slots, fromWeekday } = getSlotsForDate(availability, date);

    if (!slots.includes(time)) {
      return NextResponse.json(
        { error: "That time slot is no longer available" },
        { status: 409 }
      );
    }

    const providerOid = new ObjectId(provider_id);
    const conflict = await db.collection("bookings").findOne({
      provider_id: providerOid,
      date,
      time,
      status: { $ne: "cancelled" },
    });
    if (conflict) {
      return NextResponse.json(
        { error: "This slot is already booked" },
        { status: 409 }
      );
    }

    const user = await db.collection("users").findOne({
      _id: new ObjectId(session.userId),
    });

    const booking = {
      user_id: new ObjectId(session.userId),
      user_email: session.email,
      user_name: user?.name || session.email,
      service_id: stableServiceId,
      provider_id: providerOid,
      provider_name: provider.name || "Provider",
      provider_email: provider.email || "",
      location: provider.location || "",
      service_name: (service?.name as string) || service_name || "Service",
      price: typeof service?.price === "number" ? service.price : 0,
      date,
      time,
      duration_minutes:
        duration_minutes ||
        (typeof service?.duration_minutes === "number" ? service.duration_minutes : 60),
      status: "confirmed",
      created_at: new Date(),
    };

    let result;
    try {
      result = await db.collection("bookings").insertOne(booking);
    } catch (err: unknown) {
      const code = err && typeof err === "object" && "code" in err ? (err as { code: number }).code : 0;
      if (code === 11000) {
        return NextResponse.json(
          { error: "This slot is already booked" },
          { status: 409 }
        );
      }
      throw err;
    }

    // Consume slot via date-key override (preserve recurring weekday template)
    const remaining = slots.filter((s) => s !== time);
    const nextAvailability = { ...availability, [date]: remaining };
    // If we were reading from weekday and date key didn't exist, we still write date override
    if (fromWeekday && !availability[date]) {
      // already handled by writing date key
    }

    await db.collection("service_providers").updateOne(
      { _id: providerOid },
      { $set: { availability: nextAvailability } }
    );

    return NextResponse.json({
      success: true,
      booking_id: result.insertedId.toString(),
      booking: {
        service_name: booking.service_name,
        provider_name: booking.provider_name,
        location: booking.location,
        date: booking.date,
        time: booking.time,
        status: booking.status,
      },
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
        service_id: b.service_id?.toString?.() ?? b.service_id,
        provider_id: b.provider_id?.toString(),
      })),
    });
  } catch (error) {
    console.error("[bookings GET] error:", error);
    return NextResponse.json({ error: "Failed to fetch bookings" }, { status: 500 });
  }
}
