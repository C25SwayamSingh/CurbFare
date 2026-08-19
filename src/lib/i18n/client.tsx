"use client";

import * as React from "react";

import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";
import { makeT, type Namespace } from "@/lib/i18n/translate";

const LocaleContext = React.createContext<Locale>(DEFAULT_LOCALE);

/** Mounted once in the root layout with the request's locale. */
export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return (
    <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): Locale {
  return React.useContext(LocaleContext);
}

/** Client-component translator: `const t = useT("discover")`. */
export function useT<N extends Namespace>(namespace: N) {
  const locale = useLocale();
  return React.useMemo(() => makeT(locale, namespace), [locale, namespace]);
}
