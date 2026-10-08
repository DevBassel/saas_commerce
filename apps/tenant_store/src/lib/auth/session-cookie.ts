/**
 * Single source of truth for the NextAuth session cookie name and options.
 *
 * The proxy and the `/api/refresh` route both re-encode this cookie, so the name
 * (`__Secure-` prefix over https) and the max age must never diverge. The max
 * age mirrors `session.maxAge` in `authOptions` (NextAuth default: 30 days).
 */
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

export function sessionCookieName(): string {
  const secure = (process.env.NEXTAUTH_URL ?? "").startsWith("https://");
  return secure
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";
}

export function sessionCookieOptions(name: string = sessionCookieName()) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: name.startsWith("__Secure-"),
    maxAge: SESSION_MAX_AGE,
  };
}
