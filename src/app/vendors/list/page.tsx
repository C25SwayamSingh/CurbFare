import type { Metadata } from "next";
import Link from "next/link";
import { Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { pageTitle } from "@/lib/app-config";
import { getAuthContext } from "@/lib/auth/guards";

export const metadata: Metadata = { title: pageTitle("List your business") };

/**
 * The vendor pitch page. Signed-in visitors go straight to the application:
 * routing them through /sign-up bounced existing accounts back to the
 * customer dashboard, a dead end that cost real applicants.
 */
export default async function ListBusinessPage() {
  const ctx = await getAuthContext();

  return (
    <main className="mx-auto flex min-h-full w-full max-w-2xl flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        List your business
      </h1>
      <p className="mt-2 text-muted-foreground">
        Tell us about your cart, we review it ourselves, and your regulars can
        find you the moment you are approved.
      </p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        {ctx?.user ? (
          <Button asChild size="lg">
            <Link href="/onboarding/vendor">
              <Store aria-hidden="true" />
              Start your vendor application
            </Link>
          </Button>
        ) : (
          <>
            <Button asChild size="lg">
              <Link href="/sign-up">
                <Store aria-hidden="true" />
                Get started
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/sign-in">I already have an account</Link>
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
