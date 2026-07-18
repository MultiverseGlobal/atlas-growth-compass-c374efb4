export const ALLOWED_TEAM_EMAILS = [
  "multiverseglobals@gmail.com",
  // Add additional partner/team email addresses here as needed
];

export function isUserAdmin(email?: string): boolean {
  if (!email) return false;
  return ALLOWED_TEAM_EMAILS.includes(email.toLowerCase());
}
