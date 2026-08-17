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
  QrCode,
  Soup,
  Store,
  Truck,
} from "lucide-react";

import { APP_CONFIG } from "@/lib/app-config";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { HeroLoopVideo } from "@/components/marketing/hero-loop-video";
import { CUISINE_CATEGORIES } from "@/features/vendors/schemas";

/**
 * The cuisine quick-pick row is parked for now (owner's call, Aug 2026).
 * Flip this to bring it back; the section and its icon map stay wired.
 */
const SHOW_CUISINE_TABS = false;

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
            {viewer ? (
              viewer.firstName ? (
                <span className="text-sm text-secondary-foreground/85">
                  Hi, {viewer.firstName}
                </span>
              ) : null
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
        {/* Hero: night-market loop video over the teal block, cuisine tabs
            overlap its bottom edge. The teal block is also the fallback: no
            video file, slow network, or reduced motion all land back on it. */}
        <section className="px-4 pt-4 sm:px-6 sm:pt-6">
          <div
            className={cn(
              "relative mx-auto w-full max-w-6xl overflow-hidden rounded-3xl bg-secondary px-6 pt-12 text-secondary-foreground sm:px-12 sm:pt-16",
              SHOW_CUISINE_TABS ? "pb-24 sm:pb-28" : "pb-12 sm:pb-16",
            )}
          >
            {/* Block-style geometry: visible whenever the video isn't. */}
            <div
              aria-hidden="true"
              className="absolute -right-16 -top-16 size-56 rounded-full bg-primary/20"
            />
            <div
              aria-hidden="true"
              className="absolute -bottom-24 right-24 hidden size-40 rounded-full bg-accent/20 md:block"
            />

            {/* The loop keeps its subjects in the right two-thirds; the scrim
                keeps the left text column readable over the bright cart glow. */}
            <HeroLoopVideo
              webmSrc="/media/hero-loop.webm"
              mp4Src="/media/hero-loop.mp4"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-r from-secondary via-secondary/60 to-secondary/10"
            />

            <div className="relative max-w-2xl">
              <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">
                Food carts, trucks &amp; stands
              </p>
              <h1 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl">
                The best food{" "}
                <span className="underline decoration-primary decoration-4 underline-offset-8">
                  parks at the curb.
                </span>
              </h1>
              {/* The rewards half of the product as two numbered beats, in
                  earn-and-progress framing (the Starbucks pattern), never
                  "free stuff". Same circle treatment the customers panel
                  used, tinted for the teal hero. */}
              <div className="mt-5 max-w-xl space-y-2.5">
                <p className="flex items-center gap-2.5 text-base text-secondary-foreground/85 sm:text-lg">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 font-display text-base font-bold text-primary">
                    1
                  </span>
                  Find carts on the live map.
                </p>
                <p className="flex items-center gap-2.5 text-base text-secondary-foreground/85 sm:text-lg">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 font-display text-base font-bold text-primary">
                    2
                  </span>
                  Earn points toward rewards every time you come back.
                </p>
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                {/* Signed in, the habit loop leads: their points, one tap,
                    in the loud color. Discovery drops to the quiet slot. */}
                {viewer ? (
                  <>
                    <Button asChild size="lg" className="w-full sm:w-auto">
                      <Link href={viewer.dashboardHref}>
                        <QrCode aria-hidden="true" />
                        {viewer.dashboardHref === "/vendor"
                          ? "My Dashboard"
                          : "My Rewards"}
                      </Link>
                    </Button>
                    <Button
                      asChild
                      size="lg"
                      variant="outline"
                      className="w-full border-secondary-foreground/30 bg-transparent text-secondary-foreground hover:border-primary hover:bg-transparent hover:text-primary sm:w-auto"
                    >
                      <Link href="/discover">
                        <MapPin aria-hidden="true" />
                        Explore the map
                      </Link>
                    </Button>
                  </>
                ) : (
                  <>
                    {/* Signed out, the rewards program leads in the loud
                        color: this is a rewards app you join, not just a
                        map. Discovery keeps the quiet slot. */}
                    <Button asChild size="lg" className="w-full sm:w-auto">
                      <Link href="/sign-up">
                        <QrCode aria-hidden="true" />
                        Start earning points
                      </Link>
                    </Button>
                    <Button
                      asChild
                      size="lg"
                      variant="outline"
                      className="w-full border-secondary-foreground/30 bg-transparent text-secondary-foreground hover:border-primary hover:bg-transparent hover:text-primary sm:w-auto"
                    >
                      <Link href="/discover">
                        <MapPin aria-hidden="true" />
                        Explore the map
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Popping cuisine tabs, overlapping the hero block. Parked behind
            SHOW_CUISINE_TABS until the row earns its spot back. */}
        {SHOW_CUISINE_TABS ? (
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
        ) : null}

        {/* One panel for everything a customer needs: the four pin states
            as tappable chips, then the three steps as plain rows. One box,
            not seven — the states stay distinguishable by color + icon. */}
        <section
          id="customers"
          className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-6"
        >
          <div className="rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-6">
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
              For customers
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Search your block, walk up, earn points. One account.
            </p>
            <div className="mt-4">
              <Button asChild size="lg">
                <Link href="/discover">
                  <MapPin aria-hidden="true" />
                  Explore the map
                </Link>
              </Button>
            </div>

            <div className="my-4 border-t border-border/60" />

            <h3 className="text-lg font-bold tracking-tight">
              Know before you walk over
            </h3>
            {/* Equal-width, non-interactive legend — these teach the four
                states; the one click in this panel is the button above.
                Content is left-aligned on purpose: the cells are identical
                boxes, but centred text of varying length made them read as
                different sizes. */}
            <ul className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
              {/* Live is the loud chip: the one state that means "go now". */}
              <li className="flex flex-col items-start justify-center gap-0.5 rounded-2xl border border-border bg-background px-4 py-2.5">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
                  <span
                    aria-hidden="true"
                    className="size-2 rounded-full bg-primary motion-safe:animate-pulse"
                  />
                  Live now
                </span>
                <span className="text-sm text-muted-foreground">
                  Confirmed minutes ago
                </span>
              </li>
              <li className="flex flex-col items-start justify-center gap-0.5 rounded-2xl border border-border bg-background px-4 py-2.5">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-live">
                  <CalendarClock className="size-4" aria-hidden="true" />
                  Scheduled
                </span>
                <span className="text-sm text-muted-foreground">
                  Tonight&apos;s market
                </span>
              </li>
              <li className="flex flex-col items-start justify-center gap-0.5 rounded-2xl border border-border bg-background px-4 py-2.5">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand">
                  <Clock className="size-4" aria-hidden="true" />
                  Usually here
                </span>
                <span className="text-sm text-muted-foreground">
                  Like clockwork
                </span>
              </li>
              <li className="flex flex-col items-start justify-center gap-0.5 rounded-2xl border border-dashed border-border bg-background px-4 py-2.5">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <MapPin className="size-4" aria-hidden="true" />
                  Curbfare pick
                </span>
                <span className="text-sm text-muted-foreground">
                  Corners we scouted
                </span>
              </li>
            </ul>
          </div>
        </section>

        {/* Vendor block: the "become a seller" section, in brand teal.
            Same card geometry as the customer panel above — same width,
            radius, and padding, so the two read as siblings. */}
        <section id="vendors" className="px-4 pb-5 sm:px-6 sm:pb-6">
          <div className="mx-auto w-full max-w-6xl rounded-3xl bg-secondary p-4 text-secondary-foreground sm:p-6">
            <div className="max-w-2xl">
              <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                For vendors
              </h2>
              <p className="mt-1 text-sm text-secondary-foreground/85">
                Give your regulars a way to find you.
              </p>
              {/* Signed-in users go straight to the application; the old
                  /sign-up link bounced existing accounts to the customer
                  dashboard, a dead end. */}
              <div className="mt-4">
                <Button asChild size="lg">
                  <Link href={viewer ? "/onboarding/vendor" : "/sign-up"}>
                    <Store aria-hidden="true" />
                    Create your vendor profile
                  </Link>
                </Button>
              </div>
            </div>
            {/* Real card surfaces on the teal: a translucent tint read as a
                smudge, so these use the app's card tokens for contrast. */}
            <ul className="mt-3 grid gap-2 sm:grid-cols-3 sm:gap-3">
              <li className="rounded-2xl bg-card px-3 py-2.5 text-card-foreground shadow-sm sm:p-3">
                <h3 className="flex items-center gap-2 font-semibold">
                  <MapPin className="size-4 text-brand" aria-hidden="true" />
                  Go live in one tap
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Share today&apos;s spot instantly.
                </p>
              </li>
              <li className="rounded-2xl bg-card px-3 py-2.5 text-card-foreground shadow-sm sm:p-3">
                <h3 className="flex items-center gap-2 font-semibold">
                  <CalendarClock
                    className="size-4 text-brand"
                    aria-hidden="true"
                  />
                  Post your week
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Set it once, they show up.
                </p>
              </li>
              <li className="rounded-2xl bg-card px-3 py-2.5 text-card-foreground shadow-sm sm:p-3">
                <h3 className="flex items-center gap-2 font-semibold">
                  <Store className="size-4 text-brand" aria-hidden="true" />
                  Points, not punch cards
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Big-chain loyalty, cart-sized.
                </p>
              </li>
            </ul>
          </div>
        </section>
      </main>

      <footer className="bg-secondary py-6 text-secondary-foreground">
        <p className="text-center text-sm text-secondary-foreground/80">
          Curbfare. Street food, found.
        </p>
        <p className="mt-2 flex justify-center gap-4 text-xs text-secondary-foreground/60">
          <Link
            href="/privacy"
            className="underline-offset-2 hover:text-secondary-foreground hover:underline"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="underline-offset-2 hover:text-secondary-foreground hover:underline"
          >
            Terms
          </Link>
        </p>
      </footer>
    </div>
  );
}
