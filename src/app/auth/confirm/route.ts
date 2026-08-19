import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { confirmEmailToken } from "@/lib/auth/confirm-token";
import { safeNextPath } from "@/lib/auth/redirect";
import { createServerClient } from "@/lib/supabase/server";

function parseOtpType(value: string | null): EmailOtpType | null {
  if (!value) {
    return null;
  }
  return value as EmailOtpType;
}

async function handleConfirm(
  request: NextRequest,
  input: {
    tokenHash: string | null;
    type: EmailOtpType | null;
    next?: string | null;
  },
) {
  const supabase = await createServerClient();
  const result = await confirmEmailToken(supabase, input);

  const redirectTo = request.nextUrl.clone();
  redirectTo.search = "";
  redirectTo.pathname = result.pathname;
  if (result.flow) {
    redirectTo.searchParams.set("flow", result.flow);
  }

  // Sign-up return paths survive email confirmation via cookies set by
  // signUpAction, consumed only on a successful signup confirmation. An
  // explicit next path (invite links) outranks the vendor-onboarding
  // intent; both cookies are cleared once used.
  if (input.type === "signup" && result.pathname !== "/auth/error") {
    const nextCookie = request.cookies.get("cf-signup-next")?.value;
    const safeNext = nextCookie ? safeNextPath(nextCookie, "") : "";
    const intent = request.cookies.get("cf-signup-intent")?.value;
    const target =
      safeNext || (intent === "vendor" ? "/onboarding/vendor/profile" : null);
    if (target) {
      redirectTo.pathname = target;
      const routed = NextResponse.redirect(redirectTo, 303);
      routed.cookies.delete("cf-signup-next");
      routed.cookies.delete("cf-signup-intent");
      return routed;
    }
  }
  return NextResponse.redirect(redirectTo, 303);
}

/**
 * Verifies email-link tokens (sign-up confirmation, password recovery,
 * email change). Recovery and sign-up tokens arrive via POST from their
 * interstitial pages so automated GET prefetchers cannot consume them.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  return handleConfirm(request, {
    tokenHash: searchParams.get("token_hash"),
    type: parseOtpType(searchParams.get("type")),
    next: searchParams.get("next"),
  });
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  return handleConfirm(request, {
    tokenHash: formData.get("token_hash")?.toString() ?? null,
    type: parseOtpType(formData.get("type")?.toString() ?? null),
    next: formData.get("next")?.toString() ?? null,
  });
}
