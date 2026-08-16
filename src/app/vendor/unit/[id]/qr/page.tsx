import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Info, TriangleAlert } from "lucide-react";

import { AuthenticatedAppShell } from "@/components/app/authenticated-app-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { pageTitle } from "@/lib/app-config";
import { requireVendorMember } from "@/lib/auth/guards";
import { publicOrigin } from "@/lib/public-url";
import { createServerClient } from "@/lib/supabase/server";
import { VendorQrPoster } from "@/features/loyalty/components/vendor-qr-poster";

export const metadata: Metadata = { title: pageTitle("Rewards QR code") };

export default async function VendorUnitQrPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireVendorMember(["owner", "manager"], "/vendor");
  const supabase = await createServerClient();

  // Scoped by the caller's own organization, so an id from another org's URL
  // resolves to nothing rather than exposing their unit.
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

  const { origin, localOnly, lanOrigin } = await publicOrigin();
  const path = `/vendors/${organization.slug}/${unit.slug}/rewards`;
  const url = `${origin}${path}`;
  const phoneUrl = lanOrigin ? `${lanOrigin}${path}` : null;

  // On a local origin the QR would encode `localhost`, which resolves to the
  // scanning phone itself and simply fails. Encoding the machine's LAN address
  // instead makes the code work the moment it is pointed at during
  // development; the banner below is explicit that this build is not printable.
  const qrUrl = phoneUrl ?? url;

  return (
    <AuthenticatedAppShell>
      <div className="mx-auto max-w-lg space-y-5">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Rewards QR code
          </h1>
          <p className="text-sm text-muted-foreground">
            For {unit.name}. Print it once and leave it up.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Three steps, then done</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="space-y-2 text-sm">
              <li className="flex gap-2">
                <span className="font-bold text-brand">1.</span>
                <span>
                  <strong>Print the placard.</strong> Or save it as a PDF from
                  the print screen and text or email it to whoever has a
                  printer.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-brand">2.</span>
                <span>
                  <strong>Tape it where customers order</strong>, at eye level:
                  the counter, the window, the menu board.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-brand">3.</span>
                <span>
                  <strong>That&apos;s it.</strong> Customers scan to join and
                  earn. Staff confirm purchases in Checkout.
                </span>
              </li>
            </ol>
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href={`/vendor/unit/${unit.id}/qr/print`}>
                Open the printable placard
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">The code itself</CardTitle>
            <CardDescription>
              Same code as the placard, as a plain image for stickers, menus, or
              packaging.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VendorQrPoster url={qrUrl} unitName={unit.name} />
          </CardContent>
        </Card>

        {localOnly ? (
          <Alert variant="destructive">
            <TriangleAlert aria-hidden="true" />
            <AlertDescription>
              <strong>Testing code — don&apos;t print this one.</strong>
              <span>
                {" "}
                {phoneUrl ? (
                  <>
                    This site is only running on your computer, so the code
                    above points at{" "}
                    <code className="font-mono break-all">{lanOrigin}</code> —
                    scan it from a phone on the same Wi-Fi and it will work.
                  </>
                ) : (
                  <>
                    This site is only running on your computer at{" "}
                    <code className="font-mono">{origin}</code>, so a phone
                    cannot open the code above.
                  </>
                )}{" "}
                Once Curbfare is deployed, this page will show the real
                printable code.
              </span>
            </AlertDescription>
          </Alert>
        ) : null}

        <Alert>
          <Info aria-hidden="true" />
          <AlertDescription>
            This code never awards points by itself. Scanning it only opens your
            rewards page — points are added when you enter the eligible subtotal
            at checkout.
          </AlertDescription>
        </Alert>

        <div className="flex flex-wrap gap-2">
          <BackButton fallback="/vendor" variant="outline" />
          <Button asChild variant="ghost" size="sm">
            <Link href="/vendor/checkout">Open checkout</Link>
          </Button>
        </div>
      </div>
    </AuthenticatedAppShell>
  );
}
