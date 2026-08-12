"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, MapPin } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { QrScanner } from "@/features/loyalty/components/qr-scanner";

/**
 * Decide where a scanned cart QR may take the customer. Vendor QRs encode a
 * plain URL to the cart's public page, so only a same-origin /vendors/ path
 * is ever followed — a sticker swapped for a QR to some other site gets a
 * plain-words refusal instead of a navigation.
 */
export function cartPathFromScan(
  decoded: string,
  origin: string,
): string | null {
  try {
    const url = new URL(decoded);
    if (url.origin !== origin) return null;
    if (!url.pathname.startsWith("/vendors/")) return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

/**
 * Customer-side scanner for a cart's printed QR. Reuses the checkout
 * scanner, inheriting its camera rules: permission only on explicit tap,
 * frames never leave the device, every exit stops the tracks.
 */
export function CartQrScan() {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);

  function handleDecoded(decoded: string) {
    const path = cartPathFromScan(decoded, window.location.origin);
    if (path) {
      router.push(path);
    } else {
      setError(
        "That doesn't look like a Curbfare cart code. Look for the printed Curbfare QR at the counter.",
      );
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg tracking-tight">
          Scan the cart&apos;s QR
        </CardTitle>
        <CardDescription>
          Every Curbfare cart has a printed code at the counter. Scan it to open
          their page, join their rewards, and start earning.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <Alert variant="destructive">
            <AlertCircle aria-hidden="true" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <QrScanner
          onToken={handleDecoded}
          onCancel={() => router.push("/customer")}
          // Cart QRs encode a plain URL, not a checkout payload; hand every
          // decode through and let cartPathFromScan decide if it's ours.
          parsePayload={(raw) => raw.trim() || null}
          privacyNotice="Curbfare uses this camera only to read the cart's printed QR. Images and video are not saved."
          aimHint="Point the camera at the cart's printed code."
        />
        <p className="text-xs text-muted-foreground">
          No cart in front of you?{" "}
          <Link
            href="/discover"
            className="inline-flex items-center gap-1 font-medium text-brand underline underline-offset-2"
          >
            <MapPin className="size-3.5" aria-hidden="true" />
            Find one on the map
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
