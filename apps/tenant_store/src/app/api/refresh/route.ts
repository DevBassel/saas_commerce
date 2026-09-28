import axios from "axios";
import { encode, getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

const baseURL = process.env.NEXT_PUBLIC_BACKEND_URL;
const secret = process.env.NEXTAUTH_SECRET;

// Keep in sync with `session.maxAge` in `authOptions` (NextAuth default: 30 days).
const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

/**
 * Mirrors NextAuth's cookie naming: the `__Secure-` prefix is used whenever
 * `NEXTAUTH_URL` is served over https.
 */
function sessionCookieName() {
  const secure = (process.env.NEXTAUTH_URL ?? "").startsWith("https://");
  return secure
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";
}

/**
 * Exchanges the session's refresh token for a fresh pair and writes the rotated
 * values back into the encrypted NextAuth session cookie.
 *
 * The backend rotates the refresh token's `jti` on every call and rejects any
 * token whose `jti` no longer matches the stored session, so persisting the new
 * `refresh_token` here is required for the next refresh to succeed.
 */
export async function POST(req: NextRequest) {
  if (!baseURL || !secret) {
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

  try {
    const { data } = await axios.post<{
      access_token?: string;
      refresh_token?: string;
    }>(`${baseURL}/auth/refresh`, { refresh_token: refreshToken });

    const accessToken = data?.access_token;
    const rotatedRefreshToken = data?.refresh_token;

    if (!accessToken || !rotatedRefreshToken) {
      return NextResponse.json(
        { error: "Invalid refresh response" },
        { status: 401 },
      );
    }

    const encoded = await encode({
      token: {
        ...token,
        accessToken,
        refreshToken: rotatedRefreshToken,
      },
      secret,
      maxAge: SESSION_MAX_AGE,
    });

    const response = NextResponse.json({ access_token: accessToken });
    response.cookies.set(cookieName, encoded, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: cookieName.startsWith("__Secure-"),
      maxAge: SESSION_MAX_AGE,
    });

    // A previously chunked session cookie would otherwise be concatenated with
    // the new single-value cookie by NextAuth's SessionStore.
    for (const { name } of req.cookies.getAll()) {
      if (name.startsWith(`${cookieName}.`)) {
        response.cookies.delete(name);
      }
    }

    return response;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
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
}
