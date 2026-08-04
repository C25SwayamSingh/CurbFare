import type { Metadata } from "next";
import Link from "next/link";
import {
  Gift,
  Hourglass,
  QrCode,
  Shield,
  ShieldCheck,
  Users,
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
import { isMfaMandatoryRole, requireVendorDashboard } from "@/lib/auth/guards";
import { createServerClient } from "@/lib/supabase/server";
import { formatPoints, rewardDisplayLabel } from "@/features/loyalty/engine";
import { VendorUnitsSection } from "@/features/vendors/components/vendor-units-section";
import { TeamInvitePanel } from "@/features/organizations/components/team-invite-panel";

export const metadata: Metadata = { title: pageTitle("Vendor dashboard") };

export default async function VendorDashboardPage() {
  const ctx = await requireVendorDashboard("/vendor");

  const supabase = await createServerClient();

  const [
    { data: organization },
    { data: members },
    { data: vendorUnits },
    { data: openLocationSessions },
    { data: loyaltyPreview },
    { data: profiles },
    { data: invitations },
  ] = await Promise.all([
    supabase
      .from("organizations")
      .select("*")
      .eq("id", ctx.membership.organization_id)
      .maybeSingle(),
    supabase
      .from("organization_members")
      .select("*")
      .eq("organization_id", ctx.membership.organization_id)
      .order("created_at"),
    supabase
      .from("vendor_units")
      .select("*")
      .eq("organization_id", ctx.membership.organization_id)
      .order("created_at"),
    supabase
      .from("vendor_location_sessions")
      .select("*")
      .eq("organization_id", ctx.membership.organization_id)
      .is("ended_at", null),
    // The view already excludes programs that cannot award, so a row here
    // means rewards are genuinely live.
    supabase
      .from("loyalty_program_previews")
      .select("points_per_dollar, catalog, earning_paused")
      .eq("organization_id", ctx.membership.organization_id)
      .maybeSingle(),
    // Co-members may read each other's display names (profiles_select_shared_org).
    // Without them the roster reads "Team member / staff" for everyone, which
    // cannot answer the only question it exists to answer: who is this?
    supabase.from("profiles").select("id, display_name"),
    // RLS restricts this to owners/managers; staff get an empty list.
    supabase
      .from("organization_invitations")
      .select("id, email, first_name, role, expires_at")
      .eq("organization_id", ctx.membership.organization_id)
      .eq("status", "pending")
      .order("created_at"),
  ]);

  const isLeadership = isMfaMandatoryRole(ctx.membership.role);
  const canManageUnit =
    ctx.membership.role === "owner" || ctx.membership.role === "manager";
  const openLocationSessionsByUnitId = Object.fromEntries(
    (openLocationSessions ?? []).map((session) => [
      session.vendor_unit_id,
      session,
    ]),
  );
  const loyalty = loyaltyPreview
    ? {
        pointsPerDollar: loyaltyPreview.points_per_dollar,
        rewardCount: (loyaltyPreview.catalog ?? []).length,
      }
    : null;

  const namesByUserId = new Map(
    (profiles ?? []).map((p) => [p.id, p.display_name.trim()]),
  );
  /** A name someone set, or an honest placeholder — never a fake one. */
  function nameFor(userId: string): string {
    return namesByUserId.get(userId) || "Unnamed member";
  }

  const pendingInvites = (invitations ?? []).map((invite) => ({
    id: invite.id,
    email: invite.email,
    firstName: invite.first_name,
    role: invite.role,
    expiresAt: invite.expires_at,
  }));

  return (
    <AuthenticatedAppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {organization?.display_name ?? "Your organization"} Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            You are {ctx.membership.role === "owner" ? "an" : "a"}{" "}
            <strong>{ctx.membership.role}</strong> of this organization.
          </p>
        </div>

        {isLeadership && ctx.aal !== "aal2" ? (
          <Alert variant="default">
            <Shield aria-hidden="true" />
            <AlertDescription>
              Add two-factor authentication to better protect your business
              account.{" "}
              <Link
                href="/account/security"
                className="font-medium underline underline-offset-2"
              >
                Set it up
              </Link>
            </AlertDescription>
          </Alert>
        ) : isLeadership && ctx.aal === "aal2" ? (
          <Alert variant="success">
            <ShieldCheck aria-hidden="true" />
            <AlertDescription>
              Two-factor authentication is verified for this session. It
              protects the{" "}
              {ctx.membership.role === "owner" ? "owners" : "managers"} managing
              this organization.
            </AlertDescription>
          </Alert>
        ) : null}

        {organization?.status === "pending" ? (
          <Alert>
            <Hourglass aria-hidden="true" />
            <AlertDescription>
              Your application is under review. Set up your carts and rewards
              now; customers will see you the moment you&apos;re approved.
            </AlertDescription>
          </Alert>
        ) : organization?.status === "rejected" ? (
          <Alert variant="destructive">
            <AlertDescription>
              Your application wasn&apos;t approved, so your business stays
              hidden from customers. If you think this is a mistake, reply to
              your application email.
            </AlertDescription>
          </Alert>
        ) : null}

        {/* Rewards console: the business's own mini-SaaS, and this screen's
            flagship panel. Deep brand surface + display type so it can never
            read as one card among many — the program IS the product here. */}
        <section
          aria-label="Rewards console"
          className="relative overflow-hidden rounded-3xl bg-secondary text-secondary-foreground"
        >
          <div
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-1.5 bg-primary"
          />
          <div
            aria-hidden="true"
            className="absolute -right-20 -top-24 size-64 rounded-full bg-primary/15"
          />
          <div className="relative p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">
              Rewards console
            </p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Loyalty &amp; rewards
                </h2>
                {loyaltyPreview ? (
                  <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-bold tabular-nums text-primary">
                        {loyaltyPreview.points_per_dollar}
                      </span>
                      <span className="text-sm text-secondary-foreground/80">
                        pts per $1
                      </span>
                    </span>
                    {loyaltyPreview.earning_paused ? (
                      <span className="rounded-full bg-card/15 px-2.5 py-0.5 text-xs font-medium text-secondary-foreground/85">
                        Earning paused
                      </span>
                    ) : (
                      <span className="rounded-full bg-live/20 px-2.5 py-0.5 text-xs font-medium text-live">
                        Earning live
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="mt-2 max-w-md text-sm text-secondary-foreground/85">
                    No program yet. Design one in minutes. You approve every
                    cost before anything goes live.
                  </p>
                )}
              </div>
              {/* Both counter actions live where the money lives. Checkout is
                  the mid-service tap — oversized and unmistakably THE button;
                  managing rewards is the owner's occasional visit, quieter
                  underneath. */}
              <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:min-w-64">
                <Button
                  asChild
                  size="lg"
                  className="h-16 w-full px-8 text-lg font-bold shadow-lg ring-2 ring-primary-foreground/20 transition-transform hover:-translate-y-0.5"
                >
                  <Link href="/vendor/checkout">
                    <QrCode className="size-6" aria-hidden="true" />
                    Open checkout
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  className="h-11 w-full border-secondary-foreground/30 bg-transparent font-semibold text-secondary-foreground hover:border-primary hover:bg-transparent hover:text-primary"
                >
                  <Link href="/vendor/loyalty">
                    <Gift className="size-4" aria-hidden="true" />
                    {loyaltyPreview ? "Manage rewards" : "Set up rewards"}
                  </Link>
                </Button>
              </div>
            </div>
            {loyaltyPreview && loyaltyPreview.catalog.length > 0 ? (
              <ul className="mt-5 flex flex-wrap gap-2">
                {loyaltyPreview.catalog.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-2 rounded-full bg-card/10 px-3 py-1.5 text-xs"
                  >
                    <span className="font-semibold tabular-nums text-primary">
                      {formatPoints(item.points_cost)}
                    </span>
                    <span className="text-secondary-foreground/85">
                      {rewardDisplayLabel(
                        item.reward_kind,
                        item.reward_name,
                        item.reward_value_cents,
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Organization</CardTitle>
            <CardDescription>Your business details.</CardDescription>
          </CardHeader>
          <CardContent>
            {organization ? (
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">Display name</dt>
                  <dd className="font-medium">{organization.display_name}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Legal name</dt>
                  <dd className="font-medium">{organization.legal_name}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">URL name</dt>
                  <dd className="font-medium">{organization.slug}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="font-medium capitalize">
                    {organization.status}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">
                Organization details are unavailable right now.
              </p>
            )}
            {organization && ctx.membership.role === "owner" ? (
              <Button asChild variant="outline" size="sm" className="mt-4">
                <Link href="/vendor/organization/edit">Edit</Link>
              </Button>
            ) : null}
          </CardContent>
        </Card>

        {organization ? (
          <VendorUnitsSection
            units={vendorUnits ?? []}
            organizationSlug={organization.slug}
            canManage={canManageUnit}
            canManageLocation
            openLocationSessionsByUnitId={openLocationSessionsByUnitId}
            loyalty={loyalty}
          />
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>
              <span className="flex items-center gap-2">
                <Users className="size-5" aria-hidden="true" />
                Team
              </span>
            </CardTitle>
            <CardDescription>
              {isLeadership
                ? "Everyone with access to this organization."
                : "Your membership. Owners and managers can see the full team."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {members && members.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {members.map((member) => (
                  <li
                    key={member.id}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                  >
                    <span className="font-medium">
                      {nameFor(member.user_id)}
                      {member.user_id === ctx.user.id ? (
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          (you)
                        </span>
                      ) : null}
                    </span>
                    <span className="capitalize text-muted-foreground">
                      {member.role}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No team members to show.
              </p>
            )}
            {canManageUnit ? (
              <div className="mt-4 border-t border-border pt-4">
                <TeamInvitePanel
                  canInviteOwner={ctx.membership.role === "owner"}
                  pending={pendingInvites}
                />
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Next up for your business</CardTitle>
            <CardDescription>
              Menus and customer reviews are planned for upcoming phases. They
              are not available yet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/account">Manage your account</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AuthenticatedAppShell>
  );
}
