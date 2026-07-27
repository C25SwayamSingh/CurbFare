import { AppShell } from "@/components/app/app-shell";
import { effectivePreferredMode, hasVendorMembership } from "@/lib/auth/mode";
import { getAuthContext } from "@/lib/auth/guards";
import { ModeSwitch } from "@/features/authentication/components/mode-switch";

/** Signed-in chrome with interface mode switch (and optional page nav). */
export async function AuthenticatedAppShell({
  children,
  extraNav,
}: {
  children: React.ReactNode;
  extraNav?: { href: string; label: string }[];
}) {
  const ctx = await getAuthContext();
  const effectiveMode = ctx ? effectivePreferredMode(ctx) : "customer";
  const membership = ctx ? hasVendorMembership(ctx) : false;

  // No standing "Dashboard" item: the mode switch already names where you
  // are, and sub-pages carry their own back links. Only page-specific nav
  // (e.g. Account ↔ Security) renders here.
  const nav = extraNav && extraNav.length > 0 ? extraNav : undefined;

  return (
    <AppShell
      nav={nav}
      modeSwitch={
        ctx ? (
          <ModeSwitch
            effectiveMode={effectiveMode}
            hasMembership={membership}
          />
        ) : null
      }
    >
      {children}
    </AppShell>
  );
}
