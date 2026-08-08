"use client";

import { usePathname } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Loader2, Store, UtensilsCrossed } from "lucide-react";

import { Button } from "@/components/ui/button";
import { setPreferredModeAction } from "@/features/authentication/actions";
import type { PreferredMode } from "@/lib/supabase/database.types";

/**
 * Disables itself while its own form is submitting — must live inside the
 * `<form>` it belongs to, since useFormStatus reads the nearest ancestor
 * form's pending state. Without this, a fast double-tap could fire a second
 * mode switch before the first's redirect lands, leaving it unclear which
 * destination should win.
 */
function ModeButton({
  active,
  icon,
  label,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={active ? "default" : "outline"}
      disabled={pending}
      aria-busy={pending}
      aria-pressed={active}
      className={
        active
          ? "h-11 gap-2 px-4 text-sm font-semibold"
          : "h-11 gap-2 border-secondary-foreground/30 bg-transparent px-4 text-sm font-semibold text-secondary-foreground hover:border-primary hover:bg-transparent hover:text-primary"
      }
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        icon
      )}
      {label}
    </Button>
  );
}

/**
 * Members-only quick toggle between the customer and vendor interfaces.
 * The parent shell renders it ONLY for accounts with a vendor membership;
 * pure customers never see mode language or a vendor upsell in the chrome.
 */
export function ModeSwitch({
  effectiveMode,
}: {
  effectiveMode: PreferredMode;
}) {
  // Threaded through as a hidden field so the action can return here on
  // failure instead of jumping to an unrelated page (see setPreferredModeAction).
  const pathname = usePathname();

  return (
    <div
      className="flex items-center gap-2"
      role="group"
      aria-label="Interface mode"
    >
      <form action={setPreferredModeAction}>
        <input type="hidden" name="preferredMode" value="customer" />
        <input type="hidden" name="currentPath" value={pathname} />
        <ModeButton
          active={effectiveMode === "customer"}
          icon={<UtensilsCrossed className="size-4" aria-hidden="true" />}
          label="Customer"
        />
      </form>
      <form action={setPreferredModeAction}>
        <input type="hidden" name="preferredMode" value="vendor" />
        <input type="hidden" name="currentPath" value={pathname} />
        <ModeButton
          active={effectiveMode === "vendor"}
          icon={<Store className="size-4" aria-hidden="true" />}
          label="Vendor"
        />
      </form>
    </div>
  );
}
