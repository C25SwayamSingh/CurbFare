import "server-only";

/**
 * Emails a team invitation to the invitee. Same posture as the vendor
 * application doorbell: env-gated, fail-open (a send failure never breaks
 * invite creation; the owner still gets the copyable link as backup).
 *
 * The raw invite link transits email exactly once, here; the database
 * still stores only its digest.
 *
 *   RESEND_API_KEY            Resend API key
 *   INVITE_FROM_EMAIL         optional verified sender override
 *   VENDOR_REVIEW_FROM_EMAIL  fallback sender (already configured in prod)
 */

const RESEND_URL = "https://api.resend.com/emails";

export type InvitationEmail = {
  toEmail: string;
  firstName: string;
  organizationName: string;
  role: "owner" | "manager" | "staff";
  inviteUrl: string;
};

const ROLE_LINE: Record<InvitationEmail["role"], string> = {
  staff: "run checkout and go live at the cart",
  manager: "help run the business",
  owner: "co-own the business on Curbfare",
};

export async function notifyInvitation(invite: InvitationEmail): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log("invitation created (email notify not configured)", {
      organizationName: invite.organizationName,
    });
    return;
  }

  const lines = [
    `Hi ${invite.firstName},`,
    "",
    `${invite.organizationName} invited you to ${ROLE_LINE[invite.role]} on Curbfare.`,
    "",
    "Open your invite:",
    invite.inviteUrl,
    "",
    "If you don't have a Curbfare account yet, the page will ask you to",
    `create one first. Use this same email address (${invite.toEmail}),`,
    "then the invite finishes automatically.",
    "",
    "Didn't expect this? You can ignore this email.",
  ];

  try {
    const response = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from:
          process.env.INVITE_FROM_EMAIL ??
          process.env.VENDOR_REVIEW_FROM_EMAIL ??
          "Curbfare <onboarding@resend.dev>",
        to: [invite.toEmail],
        subject: `${invite.organizationName} invited you to their team on Curbfare`,
        text: lines.join("\n"),
      }),
    });
    if (!response.ok) {
      console.error("invitation notify failed", { status: response.status });
    }
  } catch (error) {
    console.error("invitation notify failed", {
      name: error instanceof Error ? error.name : "unknown",
    });
  }
}
