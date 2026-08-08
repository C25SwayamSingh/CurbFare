/**
 * Shared result shape for form server actions, consumed by useActionState.
 * Only safe, user-presentable messages are ever placed in `message` —
 * raw database or auth errors are logged server-side, not surfaced.
 */

export type FieldErrors = Record<string, string[] | undefined>;

export type ActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: FieldErrors;
  /**
   * Non-secret values echoed back so a rejected submit doesn't wipe what the
   * user typed. React resets an uncontrolled form after every action, so
   * without this a single bad password costs them every other field.
   */
  values?: Record<string, string>;
};

export const idleState: ActionState = { status: "idle" };

/**
 * Field names that must never round-trip through action state. A password
 * echoed into rendered HTML would sit in the page source, in React's
 * serialized state, and in any error-reporting snapshot of the DOM. Users
 * retype the secret; they should never retype everything else.
 */
const SECRET_FIELDS = new Set([
  "password",
  "currentPassword",
  "newPassword",
  "confirmPassword",
  "code",
  "token",
  "token_hash",
]);

/**
 * Pick the named fields out of a submission so they can be re-rendered as
 * defaults. Secret fields are dropped even if explicitly requested.
 */
export function keepValues(
  formData: FormData,
  fields: readonly string[],
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of fields) {
    if (SECRET_FIELDS.has(field)) continue;
    const raw = formData.get(field);
    if (typeof raw === "string" && raw !== "") {
      values[field] = raw;
    }
  }
  return values;
}

export function errorState(
  message: string,
  fieldErrors?: FieldErrors,
  values?: Record<string, string>,
): ActionState {
  return { status: "error", message, fieldErrors, values };
}

export function successState(message?: string): ActionState {
  return { status: "success", message };
}
