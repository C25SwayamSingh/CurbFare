import { en, type Messages } from "@/lib/i18n/messages/en";
import { es } from "@/lib/i18n/messages/es";
import { ar } from "@/lib/i18n/messages/ar";
import type { Locale } from "@/lib/i18n/config";

export const MESSAGES: Record<Locale, Messages> = { en, es, ar };

export type Namespace = keyof Messages;

/**
 * Build a translator for one namespace. Lookup can never miss at runtime
 * because the catalogs are structurally typed against the English source;
 * {tokens} are replaced from `values`.
 */
export function makeT<N extends Namespace>(locale: Locale, namespace: N) {
  const table = MESSAGES[locale][namespace] as Record<string, string>;
  return function t(
    key: keyof Messages[N] & string,
    values?: Record<string, string | number>,
  ): string {
    let out = table[key];
    if (values) {
      for (const [name, value] of Object.entries(values)) {
        out = out.replaceAll(`{${name}}`, String(value));
      }
    }
    return out;
  };
}
