import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Beef,
  CakeSlice,
  CalendarClock,
  Clock,
  Coffee,
  CookingPot,
  Flame,
  Leaf,
  MapPin,
  MoonStar,
  Pizza,
  Salad,
  Sandwich,
  Soup,
  Store,
  Truck,
} from "lucide-react";

import { APP_CONFIG } from "@/lib/app-config";
import { Button } from "@/components/ui/button";
import { CUISINE_CATEGORIES } from "@/features/vendors/schemas";

/**
 * One icon per cuisine quick-pick. Driven by CUISINE_CATEGORIES so the row
 * can never drift from the real filter vocabulary; a cuisine without a
 * mapping falls back to the cart itself.
 */
const CUISINE_ICONS: Record<string, LucideIcon> = {
  halal: MoonStar,
  mediterranean: Salad,
  desserts: CakeSlice,
  coffee_and_drinks: Coffee,
  mexican: Flame,
  asian: Soup,
  italian: Pizza,
  indian: CookingPot,
  bbq: Beef,
  vegan_vegetarian: Leaf,
  american: Sandwich,
};

export type LandingViewer = {
  /** First name for the greeting; null when the profile has no display name. */
  firstName: string | null;
  /** Where "dashboard" means for this person (vendor, customer, onboarding). */
  dashboardHref: string;
};

/**
 * Marketing landing, marketplace-pattern: search-first hero → popping cuisine
 * tabs → the four location states as cards → customer steps → vendor block.
 *
 * The four-state cards reuse the discovery vocabulary on purpose ("Live now",
 * "Usually here", hotspot = place, never a vendor) so the landing page teaches
 * the same honesty the product enforces.
 *
 * `viewer` is the session state: null renders Sign in / Sign up; a signed-in
 * visitor gets a greeting and their dashboard instead — the page must never
 * ask an existing user to sign up.
 */
export function LandingPage({
  viewer = null,
}: {
  viewer?: LandingViewer | null;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="bg-secondary text-secondary-foreground">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Truck className="size-6 text-primary" aria-hidden="true" />
            <span className="text-lg font-semibold tracking-tight">
              {APP_CONFIG.name}
            </span>
          </div>
          <div className="flex items-center gap-4 sm:gap-6">
            <nav className="hidden gap-6 text-sm text-secondary-foreground/80 sm:flex">
              <a
                href="#customers"
                className="transition-colors hover:text-primary"
              >
                For Customers
              </a>
              <a
                href="#vendors"
                className="transition-colors hover:text-primary"
              >
                For Vendors
              </a>
            </nav>
            {viewer ? (
              <>
                {/* Same word as the signed-in shell's nav — one "Dashboard",
                    one destination, no second dashboard to wonder about. */}
                <Button asChild size="sm">
                  <Link href={viewer.dashboardHref}>Dashboard</Link>
                </Button>
                {viewer.firstName ? (
                  <span className="hidden text-sm text-secondary-foreground/85 sm:inline">
                    Hi, {viewer.firstName}
                  </span>
                ) : null}
              </>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/sign-in">Sign in</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/sign-up">Sign up</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero: one loud teal block, cuisine tabs overlap its bottom edge. */}
        <section className="px-4 pt-4 sm:px-6 sm:pt-6">
          <div className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-3xl bg-secondary px-6 pb-24 pt-12 text-secondary-foreground sm:px-12 sm:pb-28 sm:pt-16">
            {/* Block-style geometry, not photography: cheap, token-true. */}
            <div
              aria-hidden="true"
              className="absolute -right-16 -top-16 size-56 rounded-full bg-primary/20"
            />
            <div
              aria-hidden="true"
              className="absolute -bottom-24 right-24 hidden size-40 rounded-full bg-accent/20 md:block"
            />

            <div className="relative max-w-2xl">
              <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">
                Food carts, trucks &amp; stands
              </p>
              <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl">
                The best food isn&apos;t in a building.{" "}
                <span className="underline decoration-primary decoration-4 underline-offset-8">
                  It&apos;s parked nearby.
                </span>
              </h1>
              <p className="mt-5 max-w-xl text-base text-secondary-foreground/85 sm:text-lg">
                See which carts are live right now, who&apos;s scheduled
                tonight, and where your favorites usually park — before you walk
                over.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="w-full sm:w-auto">
                  <Link href="/discover">
                    <MapPin aria-hidden="true" />
                    Find Vendors
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto"
                >
                  <Link href="/vendors/list">
                    <Store aria-hidden="true" />
                    List Your Business
                  </Link>
                </Button>
              </div>

              {/* Map-pin energy: two illustrative status chips. */}
              <div aria-hidden="true" className="mt-8 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-xs font-medium text-card-foreground shadow-sm">
                  <span className="size-2 rounded-full bg-primary motion-safe:animate-pulse" />
                  Live now · taco cart, 0.3 mi
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-xs font-medium text-card-foreground shadow-sm">
                  <Clock className="size-3.5 text-brand" />
                  Usually here · weekdays 11–3
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Popping cuisine tabs, overlapping the hero block. */}
        <section
          aria-label="Browse by cuisine"
          className="relative z-10 mx-auto -mt-12 w-full max-w-6xl px-4 sm:-mt-14 sm:px-6"
        >
          <div className="rounded-2xl border border-border bg-card p-3 shadow-lg">
            <ul className="flex snap-x gap-2 overflow-x-auto pb-1">
              {CUISINE_CATEGORIES.map((cuisine) => {
                const Icon = CUISINE_ICONS[cuisine.value] ?? Truck;
                return (
                  <li key={cuisine.value} className="snap-start">
                    <Link
                      href="/discover"
                      className="flex min-h-11 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full border border-border bg-background px-4 py-2 text-sm font-medium transition-colors duration-200 hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Icon className="size-4" aria-hidden="true" />
                      {cuisine.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* The four location states — the platform's real promise. */}
        <section className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Know before you walk over
          </h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Every result tells you exactly how much to trust it — a vendor
            standing somewhere always beats a prediction.
          </p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Live is the loud card: it's the one state that means "go now". */}
            <li className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-md">
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-full bg-primary-foreground motion-safe:animate-pulse"
                />
                Live now
              </span>
              <p className="mt-3 text-sm font-medium leading-relaxed">
                The vendor is sharing their exact spot right now — confirmed
                minutes ago, not guessed.
              </p>
            </li>
            <li className="rounded-2xl border border-border bg-card p-5">
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-live">
                <CalendarClock className="size-4" aria-hidden="true" />
                Scheduled
              </span>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                A confirmed date, time, and place — tonight&apos;s market,
                tomorrow&apos;s lunch pop-up.
              </p>
            </li>
            <li className="rounded-2xl border border-border bg-card p-5">
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand">
                <Clock className="size-4" aria-hidden="true" />
                Usually here
              </span>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Their weekly rhythm — the same corner, weekdays 11–3, confirmed
                by the vendor.
              </p>
            </li>
            <li className="rounded-2xl border border-dashed border-border bg-card/60 p-5">
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <MapPin className="size-4" aria-hidden="true" />
                Hotspot
              </span>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                A place where carts commonly set up. No vendor confirmed — and
                we&apos;ll never pretend otherwise.
              </p>
            </li>
          </ul>
        </section>

        {/* Customer steps. */}
        <section
          id="customers"
          className="border-y border-border/60 bg-muted/60 py-14 sm:py-20"
        >
          <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              For customers
            </h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Three steps between you and the cart.
            </p>
            <ol className="mt-8 grid gap-4 sm:grid-cols-3">
              <li className="rounded-2xl border border-border bg-card p-5">
                <span className="text-3xl font-bold text-primary">1</span>
                <h3 className="mt-2 font-semibold">Search your block</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  One tap shares your location for one search — never stored,
                  never tracked.
                </p>
              </li>
              <li className="rounded-2xl border border-border bg-card p-5">
                <span className="text-3xl font-bold text-primary">2</span>
                <h3 className="mt-2 font-semibold">
                  Pick who&apos;s really out
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Filter live, scheduled, and usual spots — each result says how
                  it knows.
                </p>
              </li>
              <li className="rounded-2xl border border-border bg-card p-5">
                <span className="text-3xl font-bold text-primary">3</span>
                <h3 className="mt-2 font-semibold">Walk up and earn</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Order at the window and collect points on every dollar at
                  carts with rewards.
                </p>
              </li>
            </ol>
          </div>
        </section>

        {/* Vendor block: the "become a seller" section, in brand teal. */}
        <section id="vendors" className="px-4 py-14 sm:px-6 sm:py-20">
          <div className="mx-auto w-full max-w-6xl rounded-3xl bg-secondary px-6 py-12 text-secondary-foreground sm:px-12 sm:py-16">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                For vendors
              </h2>
              <p className="mt-2 text-secondary-foreground/85">
                Your cart already has regulars. Give them a way to find you —
                and a reason to come back.
              </p>
            </div>
            <ul className="mt-8 grid gap-4 sm:grid-cols-3">
              <li className="rounded-2xl bg-card/10 p-5">
                <MapPin
                  className="mb-3 size-5 text-primary"
                  aria-hidden="true"
                />
                <h3 className="font-semibold">Go live in one tap</h3>
                <p className="mt-1 text-sm text-secondary-foreground/80">
                  Share today&apos;s spot the moment you open the window.
                </p>
              </li>
              <li className="rounded-2xl bg-card/10 p-5">
                <CalendarClock
                  className="mb-3 size-5 text-primary"
                  aria-hidden="true"
                />
                <h3 className="font-semibold">Post your week</h3>
                <p className="mt-1 text-sm text-secondary-foreground/80">
                  Usual corners and one-off events, shown honestly to customers.
                </p>
              </li>
              <li className="rounded-2xl bg-card/10 p-5">
                <Store
                  className="mb-3 size-5 text-primary"
                  aria-hidden="true"
                />
                <h3 className="font-semibold">Points, not punch cards</h3>
                <p className="mt-1 text-sm text-secondary-foreground/80">
                  A loyalty program benchmarked against the big chains — sized
                  for a cart.
                </p>
              </li>
            </ul>
            <div className="mt-8">
              <Button asChild size="lg">
                <Link href="/sign-up">Create your vendor profile</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-secondary py-6 text-secondary-foreground">
        <p className="text-center text-sm text-secondary-foreground/80">
          CurbAgora — street food, found.
        </p>
      </footer>
    </div>
  );
}
