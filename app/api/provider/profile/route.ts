import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function GET(req: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session || session.role !== "provider") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await getDb();
    const provider = await db.collection("service_providers").findOne({ _id: new ObjectId(session.userId) });

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    return NextResponse.json({ provider });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch profile" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getSessionFromCookies();
    if (!session || session.role !== "provider") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, category, location, rating, services } = body;

    const servicesArray: Array<{ name?: string; tags?: string[] }> = Array.isArray(services) ? services : [];

    // ── Auto-compute search_tags from services + category ──────────────────
    // Mirrors the logic in seed_db.py so live providers are immediately
    // discoverable by the agent without a reseed.
    const CATEGORY_TAG_MAP: Record<string, string[]> = {
      "Beauty & Hair":   ["hair","haircut","salon","trim","style","blowout","color","highlights","barber","beauty","nail","manicure","pedicure"],
      "Healthcare":      ["doctor","physician","checkup","medical","health","clinic","gp","general practitioner","prescription","consultation"],
      "Wellness & Spa":  ["massage","spa","relaxation","facial","skincare","therapy","stress","wellness","body","aromatherapy","hot stone"],
      "Fitness":         ["gym","workout","training","personal trainer","yoga","pilates","fitness","exercise","crossfit","strength","cardio"],
      "Dental":          ["dental","dentist","teeth","tooth","cavity","cleaning","orthodontist","braces","whitening","root canal"],
      "Legal":           ["lawyer","legal","attorney","law","contract","advice","consultation","litigation"],
      "Consulting":      ["consulting","consultant","business","strategy","advice","audit","planning","review","meeting"],
      "Education":       ["tutor","tutoring","learn","class","lesson","coach","teaching","study","academic"],
      "Home Services":   ["plumber","electrician","repair","cleaning","pest","handyman","maid","painting","carpenter"],
    };
    const STOP_WORDS = new Set(["with","and","for","the","your","from","this","that"]);

    const tagSet = new Set<string>();
    // 1. Category-level keywords
    (CATEGORY_TAG_MAP[category] ?? []).forEach((t: string) => tagSet.add(t.toLowerCase()));
    // 2. Per-service tags + meaningful words from service names
    for (const svc of servicesArray) {
      (svc.tags ?? []).forEach((t: string) => tagSet.add(t.toLowerCase().trim()));
      (svc.name ?? "").toLowerCase().split(/\s+/).forEach((w: string) => {
        if (w.length >= 4 && !STOP_WORDS.has(w)) tagSet.add(w);
      });
    }
    const searchTags = Array.from(tagSet).sort();
    // ── End search_tags computation ────────────────────────────────────────

    const db = await getDb();
    const result = await db.collection("service_providers").updateOne(
      { _id: new ObjectId(session.userId) },
      {
        $set: {
          name,
          category,
          location,
          rating: rating ?? 5.0,
          services: servicesArray,
          availability: typeof body.availability === "object" && !Array.isArray(body.availability)
            ? body.availability
            : {},
          search_tags:    searchTags,
          location_lower: (location ?? "").toLowerCase(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Profile updated securely!" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update profile";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
