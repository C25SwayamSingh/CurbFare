import type { Metadata } from "next";

import { pageTitle } from "@/lib/app-config";
import { getT } from "@/lib/i18n/server";
import { LanguageSwitcher } from "@/features/i18n/language-switcher";
import { BackButton } from "@/components/ui/back-button";
import { DiscoverNearby } from "@/features/discovery/components/discover-nearby";

export const metadata: Metadata = {
  title: pageTitle("Find vendors near you"),
};

export default async function DiscoverPage() {
  const t = await getT("discover");
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-12">
      <div className="flex items-center justify-between">
        <BackButton fallback="/" className="-ms-3 text-muted-foreground" />
        <LanguageSwitcher />
      </div>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">
        {t("pageTitle")}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("privacyLine")}</p>
      <div className="mt-6">
        <DiscoverNearby
          mapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? null}
        />
      </div>
    </main>
  );
}
