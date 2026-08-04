import { z } from "zod";

export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,46})[a-z0-9]$/;

/** License/permit numbers as they appear on the badge or decal. Loose on
 * purpose: formats vary, and a human reviews every application anyway. */
export const CREDENTIAL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 -]{2,30}[A-Za-z0-9]$/;

const businessDetailsShape = {
  legalName: z
    .string()
    .trim()
    .min(2, "Legal name must be at least 2 characters")
    .max(200, "Legal name is too long"),
  displayName: z
    .string()
    .trim()
    .min(2, "Display name must be at least 2 characters")
    .max(120, "Display name is too long"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      SLUG_PATTERN,
      "Use 2-48 lowercase letters, numbers, and hyphens (no leading/trailing hyphen)",
    ),
};

export const createOrganizationSchema = z.object({
  ...businessDetailsShape,
  licenseNumber: z
    .string()
    .trim()
    .regex(
      CREDENTIAL_PATTERN,
      "Enter your vending license number as it appears on your badge",
    ),
  permitNumber: z
    .string()
    .trim()
    .regex(
      CREDENTIAL_PATTERN,
      "Enter your cart permit number as it appears on the decal",
    ),
  applicationNote: z
    .string()
    .trim()
    .max(1000, "Keep your note under 1,000 characters")
    .optional()
    .transform((v) => (v ? v : null)),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

/** Business details only — editing never touches application credentials. */
export const updateOrganizationSchema = z.object(businessDetailsShape);
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

/** Derive a URL-safe slug suggestion from a display name. */
export function suggestSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
}
