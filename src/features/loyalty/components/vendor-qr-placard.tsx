"use client";

import { Printer, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/ui/back-button";
import { QrCode } from "@/features/loyalty/components/qr-code";

/**
 * The counter placard, as a full printable page.
 *
 * Like the email templates and the QR poster, this is a print artifact:
 * colors are fixed (black QR on white, teal wordmark) so it prints
 * faithfully on any printer, including black-and-white, regardless of the
 * viewer's theme. The browser's print dialog doubles as "save as PDF", which
 * is how an owner emails it to whoever has the printer.
 */
export function VendorQrPlacard({
  url,
  unitName,
}: {
  url: string;
  unitName: string;
}) {
  return (
    <div className="min-h-screen bg-white text-black">
      {/* Screen-only toolbar; vanishes on paper. */}
      <div className="flex items-center justify-between gap-2 border-b border-black/10 px-4 py-3 print:hidden">
        <BackButton fallback="/vendor" variant="outline" />
        <Button onClick={() => window.print()}>
          <Printer aria-hidden="true" />
          Print (or save as PDF)
        </Button>
      </div>

      <main className="mx-auto flex min-h-[80vh] max-w-xl flex-col items-center justify-center gap-6 px-8 py-10 text-center">
        <div className="flex items-center gap-2 text-[#31737a]">
          <Truck className="size-8" aria-hidden="true" />
          <span className="text-2xl font-bold tracking-tight">Curbfare</span>
        </div>

        <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
          Scan to earn points here
        </h1>
        <p className="text-xl font-medium text-black/70">{unitName}</p>

        <div className="w-full max-w-sm rounded-2xl border-4 border-black p-5">
          <QrCode value={url} label={`Rewards QR code for ${unitName}`} />
        </div>

        <ol className="space-y-1 text-lg font-medium">
          <li>1. Point your phone camera at the code</li>
          <li>2. Join free, no app to download</li>
          <li>3. Every dollar earns points toward rewards</li>
        </ol>

        <p className="text-sm text-black/50">curbfare.app</p>
      </main>
    </div>
  );
}
