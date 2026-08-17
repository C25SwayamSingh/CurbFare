import { NextResponse, type NextRequest } from "next/server";

import { createServerClient } from "@/lib/supabase/server";

/**
 * Cart-name suggestions for the unified discovery search box, usable
 * WITHOUT an account. Reads only vendor_unit_previews (the public view:
 * active orgs, masked contacts), matches on name, and returns just what a
 * suggestion row renders plus the slugs that link to the public page.
 */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();
  if (!query || query.length < 2 || query.length > 80) {
    return NextResponse.json({ carts: [] });
  }

  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("vendor_unit_previews")
    .select("name, slug, organization_slug, city, neighborhood")
    .ilike("name", `%${query.replaceAll("%", "").replaceAll("_", "")}%`)
    .order("name")
    .limit(5);

  if (error) {
    return NextResponse.json(
      { carts: [], error: "lookup_failed" },
      {
        status: 502,
      },
    );
  }

  return NextResponse.json({
    carts: (data ?? []).map((unit) => ({
      name: unit.name,
      href: `/vendors/${unit.organization_slug}/${unit.slug}`,
      place: unit.neighborhood
        ? `${unit.neighborhood}, ${unit.city}`
        : unit.city,
    })),
  });
}
