import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  Coins,
  Gift,
  PauseCircle,
  Users,
  Wallet,
} from "lucide-react";

import { AuthenticatedAppShell } from "@/components/app/authenticated-app-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { createServerClient } from "@/lib/supabase/server";
import {
  formatCents,
  formatPoints,
  rateBps,
  rewardDisplayLabel,
} from "@/features/loyalty/engine";
import { benchmarkModelPhrase } from "@/features/loyalty/benchmarks";
import { isLoyaltyConsultantConfigured } from "@/features/loyalty/consultant";
import { LoyaltyConsultation } from "@/features/loyalty/components/loyalty-consultation";
import { LoyaltyQuickChange } from "@/features/loyalty/components/loyalty-quick-change";
import { LoyaltyPauseControl } from "@/features/loyalty/components/loyalty-pause-control";
import { LoyaltyStaffPanel } from "@/features/loyalty/components/loyalty-staff-panel";

export const metadata: Metadata = { title: pageTitle("Loyalty & rewards") };

export default async function VendorLoyaltyPage() {
  const ctx = await requireVendorMember(undefined, "/vendor/loyalty");
  const organizationId = ctx.membership.organization_id;
  // Two different permissions, deliberately split: the OWNER designs the
  // program (points scale, rewards, publishing — the business's money);
  // owners and managers OPERATE it (pause switches). Staff run checkout.
  const canDesign = ctx.membership.role === "owner";
  const canOperate =
    ctx.membership.role === "owner" || ctx.membership.role === "manager";

  const supabase = await createServerClient();

  const [
    { data: program },
    { data: version },
    { data: statsRows },
    { data: catalog },
  ] = await Promise.all([
    supabase
      .from("loyalty_programs")
      .select("*")
      .eq("organization_id", organizationId)
      .maybeSingle(),
    supabase
      .from("loyalty_program_versions")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("status", "active")
      .maybeSingle(),
    supabase.rpc("loyalty_program_stats", {
      p_organization_id: organizationId,
    }),
    supabase
      .from("loyalty_reward_catalog_items")
      .select("*")
      .eq("organization_id", organizationId)
      .order("points_cost"),
  ]);

  const stats = statsRows?.[0];
  const hasActiveProgram = Boolean(version);
  const advisorChatEnabled = canDesign && isLoyaltyConsultantConfigured();

  // The named benchmark for the live program: which chain's model these
  // numbers are (or sit between). Computed from the entry tier — the first
  // reward a customer reaches — matching the engine's headline convention.
  // `catalog` arrives ordered by points_cost, so the entry tier is row one.
  const entryTier = catalog?.[0];
  const benchmarkLine =
    version?.points_per_dollar && entryTier
      ? benchmarkModelPhrase(
          rateBps(
            entryTier.reward_value_cents,
            Math.floor(
              (entryTier.points_cost * 100) / version.points_per_dollar,
            ),
          ),
        )
      : null;

  return (
    <AuthenticatedAppShell>
      <div className="space-y-6">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link href="/vendor">
              <ArrowLeft aria-hidden="true" />
              Vendor dashboard
            </Link>
          </Button>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Loyalty &amp; rewards
          </h1>
          <p className="text-sm text-muted-foreground">
            Your program, at a glance.
          </p>
        </div>

        {hasActiveProgram && version ? (
          <>
            {/* The numbers first — a merchant reads the board before the
                fine print. Big teal figures, small labels, no invented
                trends: we only show deltas once we have real history. */}
            {stats ? (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <div className="relative rounded-2xl border border-border bg-card p-4 sm:p-5">
                  <Users
                    className="absolute right-4 top-4 size-4 text-muted-foreground/60"
                    aria-hidden="true"
                  />
                  <p className="text-3xl font-bold tabular-nums tracking-tight text-brand sm:text-4xl">
                    {stats.members}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Members
                  </p>
                </div>
                <div className="relative rounded-2xl border border-border bg-card p-4 sm:p-5">
                  <Coins
                    className="absolute right-4 top-4 size-4 text-muted-foreground/60"
                    aria-hidden="true"
                  />
                  <p className="text-3xl font-bold tabular-nums tracking-tight text-brand sm:text-4xl">
                    {Number(stats.points_issued).toLocaleString("en-US")}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Points issued
                  </p>
                </div>
                <div className="relative rounded-2xl border border-border bg-card p-4 sm:p-5">
                  <Gift
                    className="absolute right-4 top-4 size-4 text-muted-foreground/60"
                    aria-hidden="true"
                  />
                  <p className="text-3xl font-bold tabular-nums tracking-tight text-brand sm:text-4xl">
                    {stats.rewards_redeemed}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Rewards redeemed
                  </p>
                </div>
                <div className="relative rounded-2xl border border-border bg-card p-4 sm:p-5">
                  <Wallet
                    className="absolute right-4 top-4 size-4 text-muted-foreground/60"
                    aria-hidden="true"
                  />
                  <p className="text-3xl font-bold tabular-nums tracking-tight text-brand sm:text-4xl">
                    {formatCents(Number(stats.estimated_liability_cents))}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Owed in rewards
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground/80">
                    If every point were spent today. An estimate, not a bill.
                  </p>
                </div>
              </div>
            ) : null}

            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-lg tracking-tight">
                    Live program
                  </CardTitle>
                  <div className="flex gap-2">
                    {program?.earning_paused ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        <PauseCircle className="size-3" aria-hidden="true" />
                        Earning paused
                      </span>
                    ) : (
                      <span className="rounded-full bg-live/15 px-2 py-0.5 text-xs font-medium text-live">
                        Earning live
                      </span>
                    )}
                    {program?.redemption_paused ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        <PauseCircle className="size-3" aria-hidden="true" />
                        Redemptions paused
                      </span>
                    ) : null}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-3xl font-bold tabular-nums tracking-tight text-brand sm:text-4xl">
                      {version.points_per_dollar}
                    </span>
                    <span className="text-sm font-medium text-muted-foreground">
                      points per $1 · confirmed by staff at the counter
                    </span>
                  </p>
                  {benchmarkLine ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {benchmarkLine}
                    </p>
                  ) : null}
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Reward menu
                    </p>
                    {canDesign ? (
                      <a
                        href="#change-rewards"
                        className="text-xs font-medium text-brand underline underline-offset-2"
                      >
                        Edit
                      </a>
                    ) : null}
                  </div>
                  <ul className="mt-2 divide-y divide-border/60 rounded-xl border border-border/60">
                    {(catalog ?? []).map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-3 px-3 py-2.5"
                      >
                        <span className="text-sm font-medium">
                          {rewardDisplayLabel(
                            item.reward_kind,
                            item.reward_name,
                            item.reward_value_cents,
                          )}
                          {item.reward_kind === "FREE_ITEM" ? (
                            <span className="font-normal text-muted-foreground">
                              {" "}
                              · {formatCents(item.reward_value_cents)} value
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0 rounded-full bg-secondary/20 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-brand">
                          {formatPoints(item.points_cost)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {canOperate ? (
                  <LoyaltyPauseControl
                    earningPaused={Boolean(program?.earning_paused)}
                    redemptionPaused={Boolean(program?.redemption_paused)}
                  />
                ) : null}
              </CardContent>
            </Card>

            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                At the counter
              </h2>
              <p className="text-sm text-muted-foreground">
                Any staff member can confirm a code after purchase.
              </p>
            </div>
            <LoyaltyStaffPanel />

            {canDesign ? (
              <Card id="change-rewards" className="scroll-mt-4">
                <CardHeader>
                  <CardTitle className="text-lg tracking-tight">
                    Change your rewards
                  </CardTitle>
                  <CardDescription>
                    Copy a proven model in one tap, or open the full editor.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {version.points_per_dollar ? (
                    <LoyaltyQuickChange
                      pointsPerDollar={version.points_per_dollar}
                      catalog={(catalog ?? []).map((item) => ({
                        pointsCost: item.points_cost,
                        rewardKind: item.reward_kind,
                        rewardName: item.reward_name,
                        rewardValueCents: item.reward_value_cents,
                        rewardEstCostCents: item.reward_est_cost_cents,
                      }))}
                    >
                      <LoyaltyConsultation
                        organizationId={organizationId}
                        hasActiveProgram
                        aiEnabled={advisorChatEnabled}
                      />
                    </LoyaltyQuickChange>
                  ) : (
                    <LoyaltyConsultation
                      organizationId={organizationId}
                      hasActiveProgram
                      aiEnabled={advisorChatEnabled}
                    />
                  )}
                </CardContent>
              </Card>
            ) : null}
          </>
        ) : canDesign ? (
          <>
            <LoyaltyConsultation
              organizationId={organizationId}
              hasActiveProgram={false}
              aiEnabled={advisorChatEnabled}
            />
          </>
        ) : (
          <Alert>
            <AlertDescription>
              No loyalty program is published yet. The business owner can set
              one up with the advisor.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </AuthenticatedAppShell>
  );
}
