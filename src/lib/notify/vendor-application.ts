import "server-only";

/**
 * Email doorbell for new vendor applications. The review QUEUE at
 * /admin/applications is the system of record; this only tells the
 * operator to go look. Env-gated and fail-open: with no configuration it
 * logs locally, and a send failure never breaks the application itself.
 *
 *   VENDOR_REVIEW_NOTIFY_EMAIL  where the doorbell rings (e.g. vendors@…)
 *   RESEND_API_KEY              Resend API key used to send it
 *   VENDOR_REVIEW_FROM_EMAIL    optional verified sender override
 */

const RESEND_URL = "https://api.resend.com/emails";

export type VendorApplicationSummary = {
  displayName: string;
  legalName: string;
  slug: string;
  licenseNumber: string;
  permitNumber: string;
  applicationNote: string | null;
  applicantEmail: string | null;
};

export async function notifyVendorApplication(
  application: VendorApplicationSummary,
): Promise<void> {
  const to = process.env.VENDOR_REVIEW_NOTIFY_EMAIL;
  const apiKey = process.env.RESEND_API_KEY;

  if (!to || !apiKey) {
    console.log("vendor application received (email notify not configured)", {
      slug: application.slug,
    });
    return;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const lines = [
    `Business: ${application.displayName} (legal: ${application.legalName})`,
    `Slug: ${application.slug}`,
    `License #: ${application.licenseNumber}`,
    `Permit #: ${application.permitNumber}`,
    `Applicant: ${application.applicantEmail ?? "unknown"}`,
    application.applicationNote ? `Note: ${application.applicationNote}` : null,
    "",
    `Review: ${appUrl}/admin/applications`,
  ].filter((line): line is string => line !== null);

  try {
    const response = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from:
          process.env.VENDOR_REVIEW_FROM_EMAIL ??
          "CurbAgora <onboarding@resend.dev>",
        to: [to],
        subject: `New vendor application: ${application.displayName}`,
        text: lines.join("\n"),
      }),
    });
    if (!response.ok) {
      console.error("vendor application notify failed", {
        status: response.status,
      });
    }
  } catch (error) {
    console.error("vendor application notify failed", {
      name: error instanceof Error ? error.name : "unknown",
    });
  }
}
