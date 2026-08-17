import type { Metadata } from "next";
import Link from "next/link";

import { BackButton } from "@/components/ui/back-button";
import { pageTitle } from "@/lib/app-config";

export const metadata: Metadata = { title: pageTitle("Privacy policy") };

/**
 * Plain-language privacy policy. Every claim here must stay true of the
 * running product: search location is per-request and never stored, camera
 * frames never leave the device, and license/permit numbers are reviewer-only.
 * If a feature changes one of these facts, this page changes in the same
 * commit.
 */
export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-16">
      <BackButton fallback="/" className="-ml-3 text-muted-foreground" />
      <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">
        Privacy policy
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Last updated: August 13, 2026
      </p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        <section>
          <h2>The short version</h2>
          <p className="mt-2">
            Curbfare helps you find street food and earn rewards at the carts
            you love. We collect the minimum needed to run that: an email, a
            nickname, and your points. We do not sell your data, we do not run
            ads, and we do not track you across the internet.
          </p>
        </section>

        <section>
          <h2>What we collect from customers</h2>
          <ul>
            <li>
              Your email address and a nickname, when you create an account.
            </li>
            <li>
              Your points activity: which businesses you earn and redeem with,
              and the point amounts. Purchase subtotals are entered by the
              vendor&apos;s staff, never by you.
            </li>
          </ul>
          <p className="mt-2">
            Two things deliberately never leave your phone. When you search the
            map, your location is used for that one search and never stored.
            When you scan a QR code, the camera runs entirely on your device; no
            image or video is ever uploaded.
          </p>
        </section>

        <section>
          <h2>What we collect from vendors</h2>
          <ul>
            <li>Business details: legal and display name, cart info, city.</li>
            <li>
              License and permit numbers from your application. These are seen
              only during application review and are never shown publicly.
            </li>
            <li>The locations and schedules you choose to publish.</li>
          </ul>
        </section>

        <section>
          <h2>Who helps us run the site</h2>
          <p className="mt-2">
            A few service providers process data on our behalf, under their own
            privacy policies: Vercel (hosting), Supabase (database and sign-in),
            Resend (transactional email), Google Maps (maps and place search),
            and Cloudflare (domain and email routing). They receive only what is
            needed to do their job, such as your IP address when a page loads.
          </p>
        </section>

        <section>
          <h2>How we protect it</h2>
          <p className="mt-2">
            Everything travels encrypted. Every database row is protected by
            access rules that are enforced by the database itself and tested
            adversarially. Sensitive vendor actions require two-factor
            authentication. Points can only be granted by a vendor&apos;s staff
            confirming a purchase, and every change is audited. No system on the
            internet can promise it is unbreakable, so we design for the minimum
            data worth holding in the first place.
          </p>
        </section>

        <section>
          <h2>Deleting your data</h2>
          <p className="mt-2">
            Vendors can permanently delete their entire business, including all
            its data, from Edit business details. For account deletion, email us
            at vendors@curbfare.app and we will remove your account and its
            data.
          </p>
        </section>

        <section>
          <h2>Changes and contact</h2>
          <p className="mt-2">
            If this policy changes, the date at the top changes with it, and
            meaningful changes will be called out plainly. Questions:
            vendors@curbfare.app. See also our{" "}
            <Link
              href="/terms"
              className="text-brand underline underline-offset-2"
            >
              Terms of Service
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
