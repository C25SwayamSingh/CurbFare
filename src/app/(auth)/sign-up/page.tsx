import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAuthContext } from "@/lib/auth/guards";
import { safeNextPath } from "@/lib/auth/redirect";
import { SignUpForm } from "@/features/authentication/components/sign-up-form";

export const metadata: Metadata = { title: "Create account — Curbfare" };

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ intent?: string; next?: string }>;
}) {
  // ?intent=vendor (from /vendors or the landing's vendor CTA) routes the
  // whole flow toward vendor onboarding; ?next= (from an invite link)
  // carries an explicit return path. Both survive email confirmation via
  // short-lived cookies consumed by /auth/confirm.
  const { intent, next } = await searchParams;
  const vendorIntent = intent === "vendor";
  const nextPath = next ? safeNextPath(next, "") : "";

  const ctx = await getAuthContext();
  if (ctx) {
    redirect(
      nextPath || (vendorIntent ? "/onboarding/vendor/profile" : "/onboarding"),
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>
          {vendorIntent
            ? "First a quick account, then we set up your business. Ten minutes total."
            : "Find the best street food near you, or bring more customers to your cart."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SignUpForm
          intent={vendorIntent ? "vendor" : null}
          next={nextPath || null}
        />
      </CardContent>
    </Card>
  );
}
