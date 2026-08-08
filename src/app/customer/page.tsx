import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Sparkles } from "lucide-react";

import { AuthenticatedAppShell } from "@/components/app/authenticated-app-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { pageTitle } from "@/lib/app-config";
import { requireCustomer } from "@/lib/auth/guards";
import { createServerClient } from "@/lib/supabase/server";
import {
  LoyaltyPointsCard,
  type PointsCardData,
} from "@/features/loyalty/components/loyalty-points-card";

export const metadata: Metadata = { title: pageTitle("Home") };

/**
 * The customer home IS the wallet: every cart they've earned with, their
 * points and progress at each, and the checkout code one tap away. No
 * vendor machinery appears here, ever. To a customer, Curbfare is a
 * rewards app with a map, and this page is the rewards part.
 */
export default async function CustomerDashboardPage() {
  const ctx = await requireCustomer("/customer");
  const supabase = await createServerClient();

  // RLS scopes accounts to the signed-in customer.
  const { data: accounts } = await supabase
    .from("loyalty_accounts")
    .select("*")
    .eq("user_id", ctx.user.id)
    .order("updated_at", { ascending: false });

  const orgIds = (accounts ?? []).map((a) => a.organization_id);

  const { data: previews } = orgIds.length
    ? await supabase
        .from("loyalty_program_previews")
        .select("*")
        .in("organization_id", orgIds)
    : { data: [] };

  const previewByOrg = new Map(
    (previews ?? []).map((p) => [p.organization_id, p]),
  );

  const cards: PointsCardData[] = (accounts ?? [])
    .map((account): PointsCardData | null => {
      const preview = previewByOrg.get(account.organization_id);
      if (!preview) return null; // program archived/unpublished — hide the card
      return {
        organizationId: account.organization_id,
        organizationName: preview.organization_name,
        pointBalance: account.point_balance,
        pointsPerDollar: preview.points_per_dollar,
        catalog: preview.catalog,
        earningPaused: preview.earning_paused,
        redemptionPaused: preview.redemption_paused,
      };
    })
    .filter((c): c is PointsCardData => c !== null);

  const firstName = ctx.profile?.display_name?.trim().split(/\s+/)[0] ?? null;

  return (
    <AuthenticatedAppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              {firstName ? `Hey, ${firstName}` : "Hey there"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Your carts, your points, your code.
            </p>
          </div>
          <Button asChild>
            <Link href="/discover">
              <MapPin aria-hidden="true" />
              Find vendors near me
            </Link>
          </Button>
        </div>

        {cards.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="size-5 text-brand" aria-hidden="true" />
                Start your first card
              </CardTitle>
              <CardDescription>
                Find a cart with rewards, order something, and show your code at
                the counter. Your points land here.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href="/discover">
                  <MapPin aria-hidden="true" />
                  Explore the map
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <section aria-label="My carts">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">
              My carts
            </p>
            <div className="mt-3 grid gap-4 lg:grid-cols-2">
              {cards.map((card) => (
                <LoyaltyPointsCard key={card.organizationId} card={card} />
              ))}
            </div>
          </section>
        )}
      </div>
    </AuthenticatedAppShell>
  );
}
