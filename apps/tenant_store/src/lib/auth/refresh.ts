import { encode, type JWT } from "next-auth/jwt";
import { SESSION_MAX_AGE } from "./session-cookie";

export interface RotatedTokens {
  accessToken: string;
  refreshToken: string;
}

export type RotationResult =
  | ({ ok: true } & RotatedTokens)
  | { ok: false; status: number };

/**
 * Exchanges a refresh token for a fresh pair.
 *
 * Shared by the proxy refresh path and the `/api/refresh` route handler so the
 * backend contract (endpoint, body shape) lives in one place. The backend
 * rotates the refresh token's `jti`, so callers must persist the new refresh
 * token (see `encodeRotatedSession`).
 *
 * NOTE: this does not, and cannot, serialize refreshes across the edge proxy
 * and the Node route handler — they run in separate runtimes with no shared
 * locking primitive. Callers still rely on the browser-side single-flight guard
 * in `apiClient` plus the "server never refreshes mid-render" invariant.
 */
export async function requestTokenRotation(
  refreshToken: string,
): Promise<RotationResult> {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!backendUrl) return { ok: false, status: 500 };

  try {
    const res = await fetch(`${backendUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, status: res.status };

    const data = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
    };
    if (!data.access_token || !data.refresh_token) {
      return { ok: false, status: 401 };
    }

    return {
      ok: true,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    };
  } catch {
    return { ok: false, status: 0 };
  }
}

/** Re-encodes the NextAuth session cookie with rotated access/refresh tokens. */
export async function encodeRotatedSession(
  token: JWT,
  rotated: RotatedTokens,
  secret: string,
): Promise<string> {
  return encode({
    token: {
      ...token,
      accessToken: rotated.accessToken,
      refreshToken: rotated.refreshToken,
    },
    secret,
    maxAge: SESSION_MAX_AGE,
  });
}
