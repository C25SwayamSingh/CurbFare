"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Globe } from "lucide-react";

import { cn } from "@/lib/utils";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n/config";
import { useLocale, useT } from "@/lib/i18n/client";
import { setLocaleAction } from "@/features/i18n/actions";

/**
 * The globe switcher, following the researched conventions: globe icon,
 * every language named in itself (English / Español / العربية), no flags.
 * Picking a language sets the cookie and refreshes; the server re-renders
 * everything, including document direction for Arabic.
 *
 * `tone` matches the two surfaces it lives on: "header" for the teal
 * landing header, "page" for light content pages.
 */
export function LanguageSwitcher({
  tone = "page",
}: {
  tone?: "header" | "page";
}) {
  const router = useRouter();
  const locale = useLocale();
  const t = useT("common");
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  function choose(next: Locale) {
    setOpen(false);
    if (next === locale) {
      return;
    }
    startTransition(async () => {
      await setLocaleAction(next);
      router.refresh();
    });
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("language")}
        disabled={pending}
        className={cn(
          "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
          tone === "header"
            ? "text-secondary-foreground/85 hover:bg-secondary-foreground/10 hover:text-secondary-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        )}
      >
        <Globe className="size-4" aria-hidden="true" />
        {LOCALE_LABELS[locale]}
      </button>
      {open ? (
        <ul
          role="listbox"
          aria-label={t("language")}
          className="absolute end-0 z-50 mt-1 w-40 rounded-md border border-border bg-background py-1 text-foreground shadow-md"
        >
          {LOCALES.map((option) => (
            <li key={option}>
              <button
                type="button"
                role="option"
                aria-selected={option === locale}
                onClick={() => choose(option)}
                lang={option}
                className="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-sm hover:bg-accent"
              >
                {LOCALE_LABELS[option]}
                {option === locale ? (
                  <Check className="size-4 text-brand" aria-hidden="true" />
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
