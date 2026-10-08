import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import { encodeRotatedSession, requestTokenRotation } from "@/lib/auth/refresh";
import {
  sessionCookieName,
  sessionCookieOptions,
} from "@/lib/auth/session-cookie";

const secret = process.env.NEXTAUTH_SECRET;
const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

/**
 * Exchanges the session's refresh token for a fresh pair and writes the rotated
 * values back into the encrypted NextAuth session cookie.
 *
 * The backend rotates the refresh token's `jti` on every call and rejects any
 * token whose `jti` no longer matches the stored session, so persisting the new
 * `refresh_token` here is required for the next refresh to succeed.
 */
export async function POST(req: NextRequest) {
  if (!backendUrl || !secret) {
    return NextResponse.json(
      { error: "Auth is not configured" },
      { status: 500 },
    );
  }

  const cookieName = sessionCookieName();
  const token = await getToken({ req, secret });
  const refreshToken = token?.refreshToken;

  if (!token || !refreshToken) {
    return NextResponse.json(
      { error: "No active session to refresh" },
      { status: 401 },
    );
  }

  const rotation = await requestTokenRotation(refreshToken);

  if (!rotation.ok) {
    if (rotation.status === 401) {
      // Refresh token is invalid/revoked: drop the session so the client is
      // forced back through sign-in instead of looping on 401s.
      const response = NextResponse.json(
        { error: "Session expired" },
        { status: 401 },
      );
      response.cookies.delete(cookieName);
      return response;
    }

    return NextResponse.json(
      { error: "Failed to refresh session" },
      { status: 500 },
    );
  }

  const encoded = await encodeRotatedSession(token, rotation, secret);

  const response = NextResponse.json({ access_token: rotation.accessToken });
  response.cookies.set(cookieName, encoded, sessionCookieOptions(cookieName));

  // A previously chunked session cookie would otherwise be concatenated with
  // the new single-value cookie by NextAuth's SessionStore.
  for (const { name } of req.cookies.getAll()) {
    if (name.startsWith(`${cookieName}.`)) {
      response.cookies.delete(name);
    }
  }

  return response;
}
