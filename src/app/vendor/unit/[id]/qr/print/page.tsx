import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { pageTitle } from "@/lib/app-config";
import { requireVendorMember } from "@/lib/auth/guards";
import { publicOrigin } from "@/lib/public-url";
import { createServerClient } from "@/lib/supabase/server";
import { VendorQrPlacard } from "@/features/loyalty/components/vendor-qr-placard";

export const metadata: Metadata = { title: pageTitle("Print QR placard") };

/**
 * The placard as its own route, deliberately outside the app shell: the page
 * IS the printout, so the browser's print dialog needs nothing hidden except
 * the small screen-only toolbar.
 */
export default async function VendorUnitQrPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireVendorMember(["owner", "manager"], "/vendor");
  const supabase = await createServerClient();

  const [{ data: unit }, { data: organization }] = await Promise.all([
    supabase
      .from("vendor_units")
      .select("id, name, slug")
      .eq("id", id)
      .eq("organization_id", ctx.membership.organization_id)
      .maybeSingle(),
    supabase
      .from("organizations")
      .select("slug")
      .eq("id", ctx.membership.organization_id)
      .maybeSingle(),
  ]);

  if (!unit || !organization) notFound();

  const { origin, lanOrigin } = await publicOrigin();
  const path = `/vendors/${organization.slug}/${unit.slug}/rewards`;
  const url = `${lanOrigin ?? origin}${path}`;

  return <VendorQrPlacard url={url} unitName={unit.name} />;
}
