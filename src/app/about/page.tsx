import type { Metadata } from "next";
import Link from "next/link";

import { BackButton } from "@/components/ui/back-button";
import { pageTitle } from "@/lib/app-config";

export const metadata: Metadata = { title: pageTitle("About") };

/**
 * The "why we exist" page. Voice rules: vendors are business owners, never
 * props or a cause; no savior framing, no romanticizing; concrete over
 * sentimental. Short on purpose: the story is the map and the points, not
 * a manifesto.
 */
export default function AboutPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-16">
      <BackButton fallback="/" className="-ml-3 text-muted-foreground" />
      <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">
        Why Curbfare exists
      </h1>
      <p className="mt-3 text-lg text-muted-foreground">
        The best food in the city has never had a front door.
      </p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_p]:mt-2">
        <section>
          <h2>The curb came first</h2>
          <p>
            Before the food halls and the delivery apps, there was a cart on a
            corner. Street vendors are the smallest businesses a city has and
            some of the sharpest: one person, one window, out in every kind of
            weather, remembering your order before you finish saying it. New
            York taught us how much a city can run on that. It is one special
            city of many that eat this way.
          </p>
        </section>

        <section>
          <h2>Loyalty went corporate</h2>
          <p>
            The big chains figured out rewards decades ago. Buy ten coffees
            anywhere in the country and an app remembers every one. Meanwhile
            the cart that actually knows you has no way to reward you for coming
            back, and no way to tell you where it will be tomorrow. The most
            loyal relationships in food were the only ones going unrewarded.
          </p>
        </section>

        <section>
          <h2>So we built the missing half</h2>
          <p>
            Curbfare is a live map and a points program sized for a cart. A
            vendor posts their spot in one tap and runs big-chain loyalty from a
            single printed QR code: no hardware, no tablet, no cut of the sale.
            Customers find the carts they love while the food is still hot, and
            earn points at the window like they would anywhere else. The
            relationship between a cart and its regulars runs in both
            directions, so the rewards should too.
          </p>
        </section>

        <section>
          <h2>What we hold ourselves to</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              A pin only says Live when the vendor says so. We never guess and
              call it fact.
            </li>
            <li>
              Vendors keep their brand, their menu, their prices, and their
              customers. We are the map and the points, nothing more.
            </li>
            <li>
              We do not sell personal data, and cameras and locations stay on
              your device. The details are in our{" "}
              <Link href="/privacy" className="underline underline-offset-2">
                privacy policy
              </Link>
              .
            </li>
          </ul>
        </section>

        <section>
          <p className="font-medium">
            Built at the curb in New York. Headed to every city that eats
            outside.
          </p>
        </section>
      </div>
    </main>
  );
}
