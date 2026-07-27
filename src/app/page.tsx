import { LandingPage } from "@/components/marketing/landing-page";
import { getAuthContext } from "@/lib/auth/guards";
import { resolveDashboardPath } from "@/lib/auth/mode";

/**
 * The landing page is session-aware: a signed-in visitor gets a greeting and
 * a one-tap path back to their dashboard instead of Sign in / Sign up.
 * Reading the session makes this route dynamic — the price of never showing
 * "Sign up" to someone who already has an account.
 */
export default async function Home() {
  const ctx = await getAuthContext();

  const viewer = ctx
    ? {
        // First name only — a greeting, not a form field.
        firstName: ctx.profile?.display_name?.trim().split(/\s+/)[0] || null,
        // The same resolver the signed-in shell uses, so "Dashboard" always
        // means one place: vendor, customer, or onboarding as appropriate.
        dashboardHref: resolveDashboardPath(ctx),
      }
    : null;

  return <LandingPage viewer={viewer} />;
}
