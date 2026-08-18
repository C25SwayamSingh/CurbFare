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
 * placard. One screen of reading, the whole pitch scannable in thirty
 * seconds, one loud button that enters the VENDOR flow (?intent=vendor
 * carries through sign-up and email confirmation). Wording must stay
 * consistent with the outreach emails: staff-entered amounts,
 * vendor-chosen reward costs, no cut of sales.
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
        Curbfare is a website, not an app to download: your page, a pin on a
        live map, and a points program for your regulars, run from one printed
        QR code.
      </p>

      <div className="mt-8 space-y-8 text-base leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold tracking-tight">
            How it works, in three steps
          </h2>
          <ol className="mt-3 space-y-3">
            {[
              "We set up your page together. It takes about ten minutes, and every business is checked before it goes public.",
              "Tape the QR code where customers order. Customers scan it and join free in their phone's browser.",
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
          <h2 className="text-lg font-semibold tracking-tight">The deal</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>
              Free for the first 30 founding carts for six months, possibly a
              full year. After that you see any price before you pay a dollar.
            </li>
            <li>You choose the rewards and what they cost you.</li>
            <li>
              No cut of your sales, no touching your cash or how you charge.
            </li>
            <li>
              No contract. Your business, menu, and customers stay yours, and
              you can stop anytime.
            </li>
          </ul>
        </section>

        <section className="rounded-2xl bg-secondary p-5 text-secondary-foreground sm:p-6">
          <h2 className="text-lg font-semibold tracking-tight">
            Ready, or have questions?
          </h2>
          <p className="mt-1 text-sm text-secondary-foreground/85">
            The orange button starts your vendor account. Or just reply to
            Swayam&apos;s email and he will set it up with you in person.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/sign-up?intent=vendor">
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

        <p className="text-sm text-muted-foreground">
          Not a vendor, just hungry?{" "}
          <Link href="/" className="underline underline-offset-2">
            Head to the home page
          </Link>{" "}
          to find carts near you.
        </p>
      </div>
    </main>
  );
}
