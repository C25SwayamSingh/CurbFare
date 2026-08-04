"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Interstitial step for sign-up confirmation emails. Email clients and
 * Mailpit may prefetch direct verify links; this page only verifies after an
 * explicit POST, mirroring the password-recovery interstitial.
 */
export function AuthVerifyInterstitial() {
  const searchParams = useSearchParams();
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const [submitting, setSubmitting] = React.useState(false);

  const isValidSignup = Boolean(tokenHash && type === "signup");

  function handleSubmit() {
    if (submitting) {
      return;
    }
    setSubmitting(true);
  }

  if (!isValidSignup) {
    return (
      <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>This verification link isn&apos;t valid</CardTitle>
            <CardDescription>
              The link is missing required details. Open the newest email from
              CurbAgora, or sign in to your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button asChild>
              <Link href="/sign-in">Go to sign in</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/sign-up">Create an account</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>Verify your email</CardTitle>
          <CardDescription>
            You opened this from your sign-up email, so there is just one step
            left. Click below to verify and jump in.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <form action="/auth/confirm" method="POST" onSubmit={handleSubmit}>
            <input type="hidden" name="token_hash" value={tokenHash ?? ""} />
            <input type="hidden" name="type" value="signup" />
            <Button
              type="submit"
              className="w-full"
              disabled={submitting}
              aria-busy={submitting}
            >
              {submitting ? "Verifying…" : "Verify my email"}
            </Button>
          </form>
          <Button asChild variant="outline">
            <Link href="/sign-in">Go to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
