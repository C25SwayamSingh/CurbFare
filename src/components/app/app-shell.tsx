import Link from "next/link";
import { Truck } from "lucide-react";

import { APP_CONFIG } from "@/lib/app-config";
import { NavLinks } from "@/components/app/nav-links";
import { SignOutButton } from "@/features/authentication/components/sign-out-button";

/** Shared header/footer chrome for signed-in areas. */
export function AppShell({
  children,
  nav,
  modeSwitch,
}: {
  children: React.ReactNode;
  nav?: { href: string; label: string }[];
  modeSwitch?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      {/* Deep-teal brand bar — the signature CurbAgora surface. */}
      <header className="bg-secondary text-secondary-foreground">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          {/* The logo IS the home button, the way every major site does it:
              icon + wordmark, pointer cursor, visible hover feedback. */}
          <Link
            href="/"
            title={`${APP_CONFIG.name} home`}
            className="flex items-center gap-2 text-lg font-semibold tracking-tight transition-opacity hover:opacity-75"
          >
            <Truck className="size-6 text-primary" aria-hidden="true" />
            {APP_CONFIG.name}
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-4">
            {nav ? (
              <nav className="flex gap-3 text-sm text-secondary-foreground/80 sm:gap-5">
                <NavLinks items={nav} />
              </nav>
            ) : null}
            {modeSwitch}
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}
