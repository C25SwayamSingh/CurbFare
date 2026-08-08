"use client";

import * as React from "react";
import { useActionState } from "react";
import {
  AlertCircle,
  Check,
  Copy,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  enrollMfaAction,
  verifyMfaEnrollmentAction,
  type MfaEnrollmentState,
} from "@/features/authentication/actions";
import { idleState } from "@/features/authentication/action-state";
import { FieldError } from "@/features/authentication/components/field-error";
import { SubmitButton } from "@/features/authentication/components/submit-button";

/**
 * TOTP enrollment: start enrollment, open it in an authenticator app (or
 * scan the QR on another device, or copy the setup key as a last resort),
 * then confirm with the first 6-digit code. All verification happens
 * server-side. MFA is always optional/self-service here — used from the
 * mandatory-MFA redirect target (`/mfa-enroll`, for sensitive vendor
 * actions and platform admins) and from `/account/security`.
 */
export function MfaEnrollment({ nextPath }: { nextPath?: string } = {}) {
  const [enrollment, setEnrollment] = React.useState<MfaEnrollmentState>();
  const [starting, setStarting] = React.useState(false);
  const [secretVisible, setSecretVisible] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [verifyState, verifyAction] = useActionState(
    verifyMfaEnrollmentAction,
    idleState,
  );

  async function startEnrollment() {
    setStarting(true);
    try {
      const result = await enrollMfaAction();
      setEnrollment(result);
    } finally {
      setStarting(false);
    }
  }

  // The secret only ever flows from the Supabase enroll response into React
  // state and, here, into the clipboard — never logged, stored, or sent
  // anywhere else.
  async function handleCopy() {
    if (!enrollment?.secret) return;
    try {
      await navigator.clipboard.writeText(enrollment.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API can be unavailable/denied; the key remains visible to
      // copy manually.
    }
  }

  if (!enrollment || enrollment.status !== "success") {
    return (
      <div className="space-y-3">
        {enrollment?.status === "error" ? (
          <Alert variant="destructive">
            <AlertCircle aria-hidden="true" />
            <AlertDescription>{enrollment.message}</AlertDescription>
          </Alert>
        ) : null}
        <Button onClick={startEnrollment} disabled={starting}>
          <ShieldCheck aria-hidden="true" />
          {starting ? "Preparing…" : "Set up authenticator app"}
        </Button>
        <p className="text-sm text-muted-foreground">
          Adds a 6-digit code as a second sign-in step, so a stolen password
          alone can&apos;t open your account. Takes about two minutes.
        </p>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Get a free authenticator app (next step has the links).</li>
          <li>Connect it with one tap, or scan a code.</li>
          <li>Type the 6-digit code it shows. Done.</li>
        </ol>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
        <li>
          No authenticator app yet? Get Google Authenticator free from the{" "}
          <a
            href="https://apps.apple.com/app/google-authenticator/id388497605"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-brand underline underline-offset-2"
          >
            App Store
          </a>{" "}
          or{" "}
          <a
            href="https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-brand underline underline-offset-2"
          >
            Google Play
          </a>
          . Already have one (1Password and Authy work too)? Skip ahead.
        </li>
        <li>
          On this phone, tap the button below. On a computer, open the app on
          your phone, tap its + button, and scan the QR code.
        </li>
        <li>Type the 6-digit code the app shows, then confirm.</li>
      </ol>

      <div className="flex flex-col gap-4">
        {enrollment.uri ? (
          <div className="order-1 sm:order-2">
            <Button asChild className="w-full sm:w-auto">
              <a href={enrollment.uri}>
                <Smartphone aria-hidden="true" />
                Open my authenticator app
              </a>
            </Button>
            <p className="mt-1 text-xs text-muted-foreground">
              Fills in the account name and key automatically. Nothing to type.
            </p>
          </div>
        ) : null}

        {enrollment.qrCode ? (
          <div className="order-2 sm:order-1">
            <p className="mb-2 text-xs text-muted-foreground">
              On a different device? Scan this QR code instead.
            </p>
            <div className="flex justify-center rounded-lg bg-white p-3 shadow-sm ring-1 ring-border/50 sm:justify-start">
              {/* Supabase returns an otpauth QR as a data URL — use img, not next/image. */}
              <img
                src={enrollment.qrCode}
                alt="QR code for authenticator app enrollment"
                width={128}
                height={128}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0"
          onClick={() => setSecretVisible((visible) => !visible)}
          aria-expanded={secretVisible}
        >
          {secretVisible ? "Hide setup key" : "Can't scan? Show setup key"}
        </Button>
        {secretVisible && enrollment.secret ? (
          <div className="mt-2 flex items-center gap-2">
            <code className="break-all rounded bg-muted px-1 py-0.5 text-xs">
              {enrollment.secret}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <Check aria-hidden="true" />
                  Copied
                </>
              ) : (
                <>
                  <Copy aria-hidden="true" />
                  Copy
                </>
              )}
            </Button>
          </div>
        ) : null}
      </div>

      <form action={verifyAction} className="space-y-3" noValidate>
        {verifyState.status === "error" && verifyState.message ? (
          <Alert variant="destructive">
            <AlertCircle aria-hidden="true" />
            <AlertDescription>{verifyState.message}</AlertDescription>
          </Alert>
        ) : null}

        <input type="hidden" name="factorId" value={enrollment.factorId} />
        {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}

        <div className="space-y-2">
          <Label htmlFor="code">6-digit code</Label>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            aria-describedby="code-error"
            aria-invalid={Boolean(verifyState.fieldErrors?.code)}
          />
          <FieldError id="code-error" errors={verifyState.fieldErrors?.code} />
        </div>

        <SubmitButton pendingLabel="Verifying…">
          Confirm and enable
        </SubmitButton>
      </form>

      <p className="text-xs text-muted-foreground">
        Recovery options live in Security settings after setup. You won&apos;t
        need to save this key.
      </p>
    </div>
  );
}
