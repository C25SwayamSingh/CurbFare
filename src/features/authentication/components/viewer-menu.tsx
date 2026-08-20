"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";

import { signOutAction } from "@/features/authentication/actions";

/**
 * The signed-in header menu: the greeting is the trigger, actions live in
 * the dropdown. Same open/dismiss mechanics as the language switcher so
 * the two header menus feel like siblings.
 */
export function ViewerMenu({
  greeting,
  signOutLabel,
}: {
  greeting: string;
  signOutLabel: string;
}) {
  const [open, setOpen] = React.useState(false);
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

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-medium text-secondary-foreground/85 transition-colors hover:bg-secondary-foreground/10 hover:text-secondary-foreground"
      >
        {greeting}
        <ChevronDown className="size-4" aria-hidden="true" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute end-0 z-50 mt-1 w-40 rounded-md border border-border bg-background py-1 text-foreground shadow-md"
        >
          <form action={signOutAction}>
            <button
              type="submit"
              role="menuitem"
              className="w-full cursor-pointer px-3 py-2 text-start text-sm hover:bg-accent"
            >
              {signOutLabel}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
