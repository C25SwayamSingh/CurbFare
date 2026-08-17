import type { Metadata } from "next";
import Link from "next/link";
import { QrCode, Store } from "lucide-react";

import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { pageTitle } from "@/lib/app-config";

export const metadata: Metadata = { title: pageTitle("For vendors") };

/**
 * The vendor-facing explainer, written for a cart owner who is not a tech
 * person and probably arrived by typing the address from Swayam's email or
 * placard. Reading level and layout goals: big type, short sentences, the
 * whole pitch scannable in thirty seconds, one loud button. Wording must
 * stay consistent with the outreach emails (same offer, same mechanics,
 * same honesty: staff-entered amounts, vendor-funded rewards, no cut).
 */
export default function ForVendorsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-16">
      <BackButton fallback="/" className="-ml-3 text-muted-foreground" />

      <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
        You run the cart. Curbfare brings them back.
      </h1>
      <p className="mt-3 text-lg text-muted-foreground">
        If Swayam emailed you or left a card at your window, this is that.
      </p>

      <div className="mt-8 space-y-8 text-base leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold tracking-tight">What you get</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              Your own page and a pin on the live map, so customers see when you
              are out.
            </li>
            <li>
              A points program like the big chains run, sized for one cart.
            </li>
            <li>
              One printed QR code for your counter. That is the whole setup.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight">
            How it works, in three steps
          </h2>
          <ol className="mt-3 space-y-3">
            {[
              "We set up your page together. It takes about ten minutes, and every business is checked before it goes public.",
              "Tape the QR code where customers order. Customers scan it and join free in their phone's browser. Nothing to download, nothing to install.",
              "When someone buys, you tap in what they spent. Five seconds. That is when they earn points.",
            ].map((step, i) => (
              <li key={step} className="flex items-start gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 font-display text-base font-bold text-primary">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight">
            What it costs
          </h2>
          <p className="mt-2">
            Free for the first 30 founding carts for six months, possibly a full
            year. After that you see any price before you pay a dollar. No
            contract. You can stop anytime.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight">
            You stay in control
          </h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>You choose the rewards and what they cost you.</li>
            <li>Curbfare never takes a cut of a sale.</li>
            <li>
              We never touch your cash, your card machine, or how you charge.
            </li>
            <li>Your business, menu, photos, and customers stay yours.</li>
          </ul>
        </section>

        <section className="rounded-2xl bg-secondary p-5 text-secondary-foreground sm:p-6">
          <h2 className="text-lg font-semibold tracking-tight">
            Ready, or have questions?
          </h2>
          <p className="mt-1 text-sm text-secondary-foreground/85">
            Sign up takes ten minutes, and Swayam will do it with you in person
            if you prefer.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/sign-up">
                <Store aria-hidden="true" />
                Start your vendor profile
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="w-full border-secondary-foreground/30 bg-transparent text-secondary-foreground hover:border-primary hover:bg-transparent hover:text-primary sm:w-auto"
            >
              <a href="mailto:swayam@curbfare.app">
                <QrCode aria-hidden="true" />
                Email swayam@curbfare.app
              </a>
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
