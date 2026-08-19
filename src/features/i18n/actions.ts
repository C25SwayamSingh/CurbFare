"use server";

import { cookies } from "next/headers";

import { LOCALE_COOKIE, isLocale } from "@/lib/i18n/config";

/** Persist the visitor's language for a year. Unknown values are ignored. */
export async function setLocaleAction(locale: string) {
  if (!isLocale(locale)) {
    return;
  }
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  });
}
