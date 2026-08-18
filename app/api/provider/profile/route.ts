import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

// ─── GET /api/provider/profile ────────────────────────────────────────────────
export async function GET() {
  try {
    const session = await getSessionFromCookies();
    if (!session || session.role !== "provider") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error } = await supabaseAdmin
      .from("provider_profiles")
      .select(`
        *,
        services (
          id, name, category, description, price, duration_minutes, is_active, sort_order, legacy_id,
          service_tags (tag)
        ),
        availability_slots (
          id, day_of_week, specific_date, start_time, is_booked
        ),
        provider_search_tags (tag)
      `)
      .eq("user_id", session.userId)
      .single();

    if (error || !profile) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    // Shape the response to match the old MongoDB format for frontend compatibility
    const availability: Record<string, string[]> = {};
    for (const slot of profile.availability_slots ?? []) {
      const key = slot.specific_date ?? slot.day_of_week ?? "unknown";
      if (!slot.is_booked) {
        if (!availability[key]) availability[key] = [];
        availability[key].push(
          typeof slot.start_time === "string"
            ? slot.start_time.substring(0, 5)
            : slot.start_time
        );
      }
    }

    const services = (profile.services ?? []).map((s: {
      id: string; name: string; category: string; description: string;
      price: number; duration_minutes: number; is_active: boolean;
      sort_order: number; legacy_id: string | null;
      service_tags: { tag: string }[];
    }) => ({
      id: s.legacy_id ?? s.id,
      name: s.name,
      description: s.description,
      price: s.price,
      duration_minutes: s.duration_minutes,
      tags: (s.service_tags ?? []).map((t: { tag: string }) => t.tag),
    }));

    return NextResponse.json({
      provider: {
        ...profile,
        name: profile.business_name,
        ownerName: profile.owner_name,
        services,
        availability,
        search_tags: (profile.provider_search_tags ?? []).map((t: { tag: string }) => t.tag),
        location_lower: profile.location?.toLowerCase() ?? "",
        role: "provider",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch profile";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── PUT /api/provider/profile ────────────────────────────────────────────────
export async function PUT(req: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session || session.role !== "provider") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, category, location, rating, services, availability } = body;

    // Get current provider profile
    const { data: currentProfile, error: fetchErr } = await supabaseAdmin
      .from("provider_profiles")
      .select("id")
      .eq("user_id", session.userId)
      .single();

    if (fetchErr || !currentProfile) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    const profileId = currentProfile.id;

    // Update provider_profiles
    const { error: updateErr } = await supabaseAdmin
      .from("provider_profiles")
      .update({
        business_name: name,
        category,
        location,
        rating: rating ?? 5.0,
      })
      .eq("id", profileId);

    if (updateErr) throw updateErr;

    // ── Update services ──────────────────────────────────────────────────────
    if (Array.isArray(services)) {
      // Delete old services and re-insert (simple approach)
      await supabaseAdmin.from("services").delete().eq("provider_id", profileId);

      for (let i = 0; i < services.length; i++) {
        const svc = services[i];
        const legacyId = `${session.userId}:${i}`;

        const { data: newSvc, error: svcErr } = await supabaseAdmin
          .from("services")
          .insert({
            provider_id: profileId,
            name: svc.name,
            category: category,
            description: svc.description ?? "",
            price: svc.price ?? 0,
            duration_minutes: svc.duration_minutes ?? 60,
            sort_order: i,
            legacy_id: legacyId,
            is_active: true,
          })
          .select("id")
          .single();

        if (svcErr) continue;

        // Insert service tags
        if (Array.isArray(svc.tags) && svc.tags.length > 0) {
          await supabaseAdmin.from("service_tags").insert(
            svc.tags.map((tag: string) => ({ service_id: newSvc.id, tag: tag.toLowerCase().trim() }))
          );
        }
      }
    }

    // ── Rebuild search_tags ──────────────────────────────────────────────────
    const CATEGORY_TAG_MAP: Record<string, string[]> = {
      "Beauty & Hair":  ["hair","haircut","salon","trim","style","blowout","color","highlights","barber","beauty","nail","manicure","pedicure"],
      "Healthcare":     ["doctor","physician","checkup","medical","health","clinic","gp","general practitioner","prescription","consultation"],
      "Wellness & Spa": ["massage","spa","relaxation","facial","skincare","therapy","stress","wellness","body","aromatherapy","hot stone"],
      "Fitness":        ["gym","workout","training","personal trainer","yoga","pilates","fitness","exercise","crossfit","strength","cardio"],
      "Dental":         ["dental","dentist","teeth","tooth","cavity","cleaning","orthodontist","braces","whitening","root canal"],
      "Legal":          ["lawyer","legal","attorney","law","contract","advice","consultation","litigation"],
      "Consulting":     ["consulting","consultant","business","strategy","advice","audit","planning","review","meeting"],
      "Education":      ["tutor","tutoring","learn","class","lesson","coach","teaching","study","academic"],
      "Home Services":  ["plumber","electrician","repair","cleaning","pest","handyman","maid","painting","carpenter"],
    };
    const STOP_WORDS = new Set(["with","and","for","the","your","from","this","that"]);

    const tagSet = new Set<string>();
    (CATEGORY_TAG_MAP[category] ?? []).forEach((t: string) => tagSet.add(t.toLowerCase()));
    if (Array.isArray(services)) {
      for (const svc of services) {
        (svc.tags ?? []).forEach((t: string) => tagSet.add(String(t).toLowerCase().trim()));
        String(svc.name ?? "").toLowerCase().split(/\s+/).forEach((w: string) => {
          if (w.length >= 4 && !STOP_WORDS.has(w)) tagSet.add(w);
        });
      }
    }

    await supabaseAdmin.from("provider_search_tags").delete().eq("provider_id", profileId);
    const tagRows = Array.from(tagSet).map((tag) => ({ provider_id: profileId, tag }));
    if (tagRows.length > 0) {
      await supabaseAdmin.from("provider_search_tags").insert(tagRows);
    }

    // ── Update availability_slots ────────────────────────────────────────────
    if (availability && typeof availability === "object") {
      await supabaseAdmin.from("availability_slots").delete().eq("provider_id", profileId);

      const slotRows: {
        provider_id: string;
        day_of_week?: string;
        specific_date?: string;
        start_time: string;
      }[] = [];

      const WEEKDAYS = new Set(["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]);

      for (const [key, times] of Object.entries(availability)) {
        if (!Array.isArray(times)) continue;
        for (const t of times) {
          if (WEEKDAYS.has(key)) {
            slotRows.push({ provider_id: profileId, day_of_week: key, start_time: t });
          } else {
            slotRows.push({ provider_id: profileId, specific_date: key, start_time: t });
          }
        }
      }

      if (slotRows.length > 0) {
        await supabaseAdmin.from("availability_slots").insert(slotRows);
      }
    }

    return NextResponse.json({ success: true, message: "Profile updated successfully!" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update profile";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}