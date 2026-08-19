import { cookies } from "next/headers";

import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isLocale,
  type Locale,
} from "@/lib/i18n/config";
import { makeT, type Namespace } from "@/lib/i18n/translate";

/** The request's locale: the cookie when valid, English otherwise. */
export async function getLocale(): Promise<Locale> {
  try {
    const raw = (await cookies()).get(LOCALE_COOKIE)?.value;
    return isLocale(raw) ? raw : DEFAULT_LOCALE;
  } catch {
    // Outside a request scope (unit tests, static rendering): English.
    return DEFAULT_LOCALE;
  }
}

/** Server-component translator: `const t = await getT("landing")`. */
export async function getT<N extends Namespace>(namespace: N) {
  return makeT(await getLocale(), namespace);
}
