import { Suspense } from "react";

import { AuthRecoveryInterstitial } from "@/features/authentication/components/auth-recovery-interstitial";

export const metadata = { title: "Continue password reset — Curbfare" };

export default function AuthRecoveryPage() {
  return (
    <Suspense fallback={null}>
      <AuthRecoveryInterstitial />
    </Suspense>
  );
}
