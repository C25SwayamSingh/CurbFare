import type { Metadata } from "next";
import Link from "next/link";

import { BackButton } from "@/components/ui/back-button";
import { pageTitle } from "@/lib/app-config";

export const metadata: Metadata = { title: pageTitle("Terms of service") };

/**
 * Plain-language terms. The IP section is the load-bearing one for the
 * business: the platform, brand, and software are ours; vendors keep their
 * own brand and content and license us to display it. Kept readable on
 * purpose; a street vendor should be able to understand what they agreed to.
 */
export default function TermsOfServicePage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-16">
      <BackButton fallback="/" className="-ml-3 text-muted-foreground" />
      <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">
        Terms of service
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Last updated: August 16, 2026
      </p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        <section>
          <h2>What Curbfare is</h2>
          <p className="mt-2">
            Curbfare (curbfare.app) connects mobile food vendors with customers:
            live locations, schedules, and loyalty rewards. By using the site
            you agree to these terms. If you do not agree, please do not use
            Curbfare.
          </p>
        </section>

        <section>
          <h2>Your account</h2>
          <ul>
            <li>Give us accurate information and keep your password safe.</li>
            <li>You are responsible for what happens under your account.</li>
            <li>
              We may suspend accounts used for fraud, abuse, or fake listings.
            </li>
          </ul>
        </section>

        <section>
          <h2>For vendors</h2>
          <ul>
            <li>
              You must hold the licenses and permits your city requires. We
              review every application before a business goes public.
            </li>
            <li>
              You fund your own rewards. Points your customers earn at your
              business are honored by your business.
            </li>
            <li>
              You control your program and can pause or change it; customers
              keep points they have already earned unless the business closes.
            </li>
          </ul>
        </section>

        <section>
          <h2>Points</h2>
          <ul>
            <li>
              Points have no cash value, cannot be sold or transferred, and
              exist only at the business that issued them.
            </li>
            <li>
              Points are recorded by our servers when a vendor&apos;s staff
              confirms a purchase. We may correct entries that result from fraud
              or error; corrections are audited.
            </li>
            <li>
              If a vendor ends their rewards program while staying in business,
              customers keep at least 30 days to redeem points they have already
              earned. If a business closes, its points program ends with it.
            </li>
            <li>
              Points are promotional benefits, not money or property. They are
              not bought, and no refund is owed for them if a program or the
              service ends.
            </li>
          </ul>
        </section>

        <section>
          <h2>Our property</h2>
          <p className="mt-2">
            The Curbfare platform is ours: the name, logo, design, software,
            databases, and every feature of the service, including discovery,
            live locations, scheduling, checkout, and the rewards system. All
            rights are reserved. You may not copy, scrape, reproduce, republish,
            sell, or build a competing service from any part of Curbfare, and
            you may not use our name or logo without written permission.
          </p>
          <p className="mt-2">
            What&apos;s yours stays yours: vendors keep ownership of their own
            business name, menu, photos, and brand, and grant us a license to
            display them so the service can work.
          </p>
        </section>

        <section>
          <h2>Honest limits</h2>
          <ul>
            <li>
              Locations are best-effort. A &quot;live&quot; pin is
              vendor-confirmed and fresh; &quot;usually here&quot; and hotspots
              are clearly labeled predictions, not promises.
            </li>
            <li>
              The service is provided as is. To the maximum extent the law
              allows, we are not liable for indirect damages, and our total
              liability is limited to the greater of $100 or what you paid us in
              the past twelve months.
            </li>
            <li>
              We may change or discontinue features, or the service itself. If
              Curbfare ever shuts down entirely, we will give reasonable advance
              notice so open rewards can be used.
            </li>
          </ul>
        </section>

        <section>
          <h2>Changes, law, contact</h2>
          <p className="mt-2">
            We may update these terms; the date above changes when we do, and
            continued use means acceptance. These terms are governed by the laws
            of the State of New York. Questions: vendors@curbfare.app. See also
            our{" "}
            <Link
              href="/privacy"
              className="text-brand underline underline-offset-2"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
