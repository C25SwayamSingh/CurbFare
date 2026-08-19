/**
 * Locale registry for the whole app. Cookie-based (no URL prefixes): the
 * default stays English so every existing test pin and shared link keeps
 * working; a visitor's choice rides one long-lived cookie.
 *
 * Research-grounded switcher rules (Smashing Magazine, Smartling): globe
 * icon, each language named in ITSELF, never flags.
 */
export const LOCALES = ["en", "es", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "cf-locale";

/** Native-name labels, per the never-translate-a-language's-name rule. */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  es: "Español",
  ar: "العربية",
};

/** Arabic renders the entire document right-to-left. */
export const RTL_LOCALES: ReadonlySet<Locale> = new Set(["ar"]);

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && (LOCALES as readonly string[]).includes(value)
  );
}

export function directionFor(locale: Locale): "ltr" | "rtl" {
  return RTL_LOCALES.has(locale) ? "rtl" : "ltr";
}
