export const sessionCookieName = "crm_session";

export function getAuthSecretKey() {
  const secret = process.env.AUTH_SECRET ?? "development-secret-change-me-minimum-32-characters";
  return new TextEncoder().encode(secret);
}
