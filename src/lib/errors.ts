/**
 * Translates raw Supabase/Postgres errors into plain-English user-facing messages.
 * Add new patterns here as new errors are encountered.
 */
export function friendlyError(err: unknown, context?: string): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "object" && err !== null && "message" in err
      ? String((err as { message: unknown }).message)
      : String(err);

  const lower = raw.toLowerCase();

  // ── Unique constraint violations ──────────────────────────────────────────
  if (lower.includes("profiles_handle_key") || lower.includes("unique constraint") && lower.includes("handle")) {
    return "That handle is already taken — try a different one.";
  }
  if (lower.includes("unique constraint") || lower.includes("duplicate key")) {
    return "That value is already in use — please try a different one.";
  }

  // ── Auth errors ───────────────────────────────────────────────────────────
  if (lower.includes("invalid login credentials") || lower.includes("invalid email or password")) {
    return "Incorrect email or password. Double-check and try again.";
  }
  if (lower.includes("email not confirmed")) {
    return "Please verify your email first — check your inbox for a confirmation link.";
  }
  if (lower.includes("user already registered") || lower.includes("already been registered")) {
    return "An account with that email already exists. Try signing in instead.";
  }
  if (lower.includes("provider is not enabled") || lower.includes("unsupported provider")) {
    return "This sign-in method isn't enabled yet. Contact support if this keeps happening.";
  }
  if (lower.includes("token has expired") || lower.includes("refresh_token_not_found")) {
    return "Your session expired. Please sign in again.";
  }
  if (lower.includes("rate limit") || lower.includes("too many requests") || lower.includes("over_email_send_rate_limit")) {
    return "Too many attempts — please wait a minute before trying again.";
  }
  if (lower.includes("password should be at least")) {
    return "Password must be at least 6 characters.";
  }

  // ── Database / RLS errors ─────────────────────────────────────────────────
  if (lower.includes("row-level security") || lower.includes("violates row-level")) {
    return "You don't have permission to do that.";
  }
  if (lower.includes("foreign key") || lower.includes("violates foreign key")) {
    return "Something this depends on doesn't exist anymore. Try refreshing.";
  }
  if (lower.includes("null value in column") || lower.includes("not-null constraint")) {
    return "A required field is missing. Please fill in all required fields.";
  }
  if (lower.includes("network") || lower.includes("fetch") || lower.includes("failed to fetch")) {
    return "Network error — check your connection and try again.";
  }

  // ── Fallback ──────────────────────────────────────────────────────────────
  // If context provided, prepend it; otherwise return a generic message
  if (context) return `${context}. Please try again.`;
  return "Something went wrong — please try again.";
}
