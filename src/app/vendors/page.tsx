import type { Metadata } from "next";
import Link from "next/link";
import { QrCode, Store } from "lucide-react";

import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { pageTitle } from "@/lib/app-config";
import { getT } from "@/lib/i18n/server";
import { LanguageSwitcher } from "@/features/i18n/language-switcher";

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
export default async function ForVendorsPage() {
  const t = await getT("vendorsPage");
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-16">
      <div className="flex items-center justify-between">
        <BackButton fallback="/" className="-ms-3 text-muted-foreground" />
        <LanguageSwitcher />
      </div>

      <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
        {t("title")}
      </h1>
      <p className="mt-3 text-lg text-muted-foreground">{t("subtitle")}</p>

      <div className="mt-8 space-y-8 text-base leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold tracking-tight">
            {t("howHeading")}
          </h2>
          <ol className="mt-3 space-y-3">
            {[t("step1"), t("step2"), t("step3")].map((step, i) => (
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
            {t("dealHeading")}
          </h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>{t("deal1")}</li>
            <li>{t("deal2")}</li>
            <li>{t("deal3")}</li>
            <li>{t("deal4")}</li>
          </ul>
        </section>

        <section className="rounded-2xl bg-secondary p-5 text-secondary-foreground sm:p-6">
          <h2 className="text-lg font-semibold tracking-tight">
            {t("readyHeading")}
          </h2>
          <p className="mt-1 text-sm text-secondary-foreground/85">
            {t("readySub")}
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/sign-up?intent=vendor">
                <Store aria-hidden="true" />
                {t("startCta")}
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
                {t("emailCta")}
              </a>
            </Button>
          </div>
        </section>

        <p className="text-sm text-muted-foreground">
          {t("hungryLead")}{" "}
          <Link href="/" className="underline underline-offset-2">
            {t("hungryLink")}
          </Link>{" "}
          {t("hungryTail")}
        </p>
      </div>
    </main>
  );
}
