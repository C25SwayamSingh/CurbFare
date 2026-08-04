import type { Metadata } from "next";
import { BadgeCheck, Building2, Inbox } from "lucide-react";

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
import { Input } from "@/components/ui/input";
import { pageTitle } from "@/lib/app-config";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { createServerClient } from "@/lib/supabase/server";
import {
  approveVendorApplicationAction,
  rejectVendorApplicationAction,
} from "@/features/organizations/review-actions";

export const metadata: Metadata = { title: pageTitle("Vendor applications") };

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * The behind-the-scenes half of vendor verification: every application
 * lands here as a pending organization, invisible to customers until a
 * human approves it. License and permit numbers are applicant claims for
 * the reviewer's eyes only.
 */
export default async function VendorApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePlatformAdmin("/admin/applications");
  const { error } = await searchParams;

  const supabase = await createServerClient();
  const [{ data: pending }, { data: recent }] = await Promise.all([
    supabase
      .from("organizations")
      .select("*")
      .eq("status", "pending")
      .order("applied_at", { ascending: true }),
    supabase
      .from("organizations")
      .select("*")
      .in("status", ["active", "rejected"])
      .not("reviewed_at", "is", null)
      .order("reviewed_at", { ascending: false })
      .limit(10),
  ]);

  return (
    <AuthenticatedAppShell
      extraNav={[
        { href: "/admin/locations", label: "Location imports" },
        { href: "/admin/applications", label: "Applications" },
      ]}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Vendor applications
          </h1>
          <p className="text-sm text-muted-foreground">
            Pending businesses stay invisible to customers until approved here.
          </p>
        </div>

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {(pending ?? []).length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Inbox className="size-5 text-brand" aria-hidden="true" />
                No pending applications
              </CardTitle>
              <CardDescription>
                New applications appear here and ring the notification email
                when one is configured.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <ul className="space-y-4">
            {(pending ?? []).map((org) => (
              <li key={org.id}>
                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Building2
                          className="size-5 text-brand"
                          aria-hidden="true"
                        />
                        {org.display_name}
                      </CardTitle>
                      <span className="text-xs text-muted-foreground">
                        Applied {formatWhen(org.applied_at)}
                      </span>
                    </div>
                    <CardDescription>
                      {org.legal_name} · /{org.slug}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                          License number
                        </dt>
                        <dd className="font-mono font-medium">
                          {org.license_number ?? "not provided"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                          Permit number
                        </dt>
                        <dd className="font-mono font-medium">
                          {org.permit_number ?? "not provided"}
                        </dd>
                      </div>
                    </dl>
                    {org.application_note ? (
                      <p className="rounded-lg bg-muted/60 p-3 text-sm">
                        {org.application_note}
                      </p>
                    ) : null}

                    <div className="flex flex-wrap items-end gap-3">
                      <form action={approveVendorApplicationAction}>
                        <input
                          type="hidden"
                          name="organizationId"
                          value={org.id}
                        />
                        <Button type="submit">
                          <BadgeCheck aria-hidden="true" />
                          Approve
                        </Button>
                      </form>
                      <form
                        action={rejectVendorApplicationAction}
                        className="flex flex-wrap items-end gap-2"
                      >
                        <input
                          type="hidden"
                          name="organizationId"
                          value={org.id}
                        />
                        <div className="space-y-1">
                          <label
                            htmlFor={`note-${org.id}`}
                            className="text-xs text-muted-foreground"
                          >
                            Reason (kept private)
                          </label>
                          <Input
                            id={`note-${org.id}`}
                            name="note"
                            placeholder="e.g. license number not found"
                            className="h-9 w-64"
                          />
                        </div>
                        <Button type="submit" variant="outline">
                          Reject
                        </Button>
                      </form>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}

        {(recent ?? []).length > 0 ? (
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Recently reviewed
            </h2>
            <ul className="mt-2 space-y-1 text-sm">
              {(recent ?? []).map((org) => (
                <li
                  key={org.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                >
                  <span className="font-medium">{org.display_name}</span>
                  <span
                    className={
                      org.status === "active"
                        ? "text-xs font-medium text-success"
                        : "text-xs font-medium text-destructive"
                    }
                  >
                    {org.status === "active" ? "Approved" : "Rejected"}
                    {org.reviewed_at ? ` · ${formatWhen(org.reviewed_at)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </AuthenticatedAppShell>
  );
}
