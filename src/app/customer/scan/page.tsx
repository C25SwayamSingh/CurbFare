import type { Metadata } from "next";

import { AuthenticatedAppShell } from "@/components/app/authenticated-app-shell";
import { BackButton } from "@/components/ui/back-button";
import { pageTitle } from "@/lib/app-config";
import { requireCustomer } from "@/lib/auth/guards";
import { CartQrScan } from "@/features/loyalty/components/cart-qr-scan";

export const metadata: Metadata = { title: pageTitle("Scan a cart") };

export default async function CustomerScanPage() {
  await requireCustomer("/customer/scan");

  return (
    <AuthenticatedAppShell>
      <div className="mx-auto w-full max-w-md space-y-4">
        <BackButton fallback="/customer" className="-ml-2" />
        <CartQrScan />
      </div>
    </AuthenticatedAppShell>
  );
}
