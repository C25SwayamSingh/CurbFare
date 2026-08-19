import type { Metadata } from "next";
import Link from "next/link";

import { BackButton } from "@/components/ui/back-button";
import { pageTitle } from "@/lib/app-config";
import { getT } from "@/lib/i18n/server";
import { LanguageSwitcher } from "@/features/i18n/language-switcher";

export const metadata: Metadata = { title: pageTitle("About") };

/**
 * The "why we exist" page. Voice rules: vendors are business owners, never
 * props or a cause; no savior framing, no romanticizing; concrete over
 * sentimental. Short on purpose: the story is the map and the points, not
 * a manifesto.
 */
export default async function AboutPage() {
  const t = await getT("about");
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-16">
      <div className="flex items-center justify-between">
        <BackButton fallback="/" className="-ms-3 text-muted-foreground" />
        <LanguageSwitcher />
      </div>
      <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">
        {t("title")}
      </h1>
      <p className="mt-3 text-lg text-muted-foreground">{t("subtitle")}</p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_p]:mt-2">
        <section>
          <h2>{t("curbHeading")}</h2>
          <p>{t("curbBody")}</p>
        </section>

        <section>
          <h2>{t("loyaltyHeading")}</h2>
          <p>{t("loyaltyBody")}</p>
        </section>

        <section>
          <h2>{t("builtHeading")}</h2>
          <p>{t("builtBody")}</p>
        </section>

        <section>
          <h2>{t("holdHeading")}</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>{t("hold1")}</li>
            <li>{t("hold2")}</li>
            <li>
              {t("hold3Lead")}{" "}
              <Link href="/privacy" className="underline underline-offset-2">
                {t("hold3Link")}
              </Link>
              .
            </li>
          </ul>
        </section>

        <section>
          <p className="font-medium">{t("closing")}</p>
          <p className="mt-2 text-muted-foreground">
            {t("questionsLead")}{" "}
            <a
              href="mailto:swayam@curbfare.app"
              className="underline underline-offset-2"
            >
              swayam@curbfare.app
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
