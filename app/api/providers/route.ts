import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const search = searchParams.get("search");

    let query = supabaseAdmin
      .from("provider_profiles")
      .select(`
        id,
        business_name,
        owner_name,
        category,
        description,
        location,
        rating,
        total_reviews,
        is_verified,
        services (
          id, name, price, duration_minutes, description
        )
      `)
      .order("rating", { ascending: false });

    if (category && category !== "All") {
      query = query.eq("category", category);
    }

    if (search && search.trim()) {
      query = query.or(`business_name.ilike.%${search}%,location.ilike.%${search}%,category.ilike.%${search}%`);
    }

    const { data: providers, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      providers: (providers || []).map((p) => ({
        id: p.id,
        name: p.business_name,
        category: p.category,
        rating: Number(p.rating) || 5.0,
        location: p.location || "Bangalore",
        subtitle: `${p.category} • ${p.location || "Available for booking"}`,
        description: p.description || "",
        badgeText: p.is_verified ? "Verified Slots" : "Instant Book",
        badgeType: p.is_verified ? "verified" : "instant",
        services: p.services || [],
      })),
    });
  } catch (error) {
    console.error("[providers GET] error:", error);
    return NextResponse.json({ error: "Failed to fetch providers" }, { status: 500 });
  }
}