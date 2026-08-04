import { Suspense } from "react";

import { AuthVerifyInterstitial } from "@/features/authentication/components/auth-verify-interstitial";

export const metadata = { title: "Verify your email — CurbAgora" };

export default function AuthVerifyPage() {
  return (
    <Suspense fallback={null}>
      <AuthVerifyInterstitial />
    </Suspense>
  );
}
