import { jwtDecode } from "jwt-decode";
import { withAuth, type NextRequestWithAuth } from "next-auth/middleware";
import { encode, getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";

const secret = process.env.NEXTAUTH_SECRET;
const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

// Keep in sync with `session.maxAge` in `authOptions` (NextAuth default: 30 days).
const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

/**
 * NextAuth handler that redirects unauthenticated users to /login.
 * `authorized` returns true only when a valid JWT token is present.
 */
const authHandler = withAuth(
  function middleware() {
    // Token is present – let the request through.
    return NextResponse.next();
  },
  {
    pages: { signIn: "/login" },
    callbacks: {
      authorized: ({ token }) => token !== null,
    },
  },
);

/** Mirrors NextAuth's cookie naming (secure prefix when served over https). */
function sessionCookieName() {
  const secure = (process.env.NEXTAUTH_URL ?? "").startsWith("https://");
  return secure
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token";
}

function isAccessTokenExpired(accessToken?: string) {
  if (!accessToken) return true;
  try {
    const { exp } = jwtDecode<{ exp?: number }>(accessToken);
    return typeof exp === "number"
      ? exp <= Math.floor(Date.now() / 1000)
      : false;
  } catch {
    return true;
  }
}

/**
 * Rotates the NextAuth session when the backend access token has expired.
 *
 * Server Components cannot write cookies, so a refresh attempted during render
 * could not persist the rotated refresh token (the backend invalidates the old
 * one via its `jti`). Refreshing here, before render, lets us both persist the
 * cookie on the response and forward it to the current request so
 * `getServerSession()` sees the fresh tokens.
 *
 * Returns the re-encoded cookie, or `null` when no refresh is needed/possible.
 */
async function refreshSession(req: NextRequest) {
  if (!secret || !backendUrl) return null;

  const token = await getToken({ req, secret });
  if (!token?.refreshToken || !isAccessTokenExpired(token.accessToken)) {
    return null;
  }

  try {
    console.log("Refreshing session...");

    const res = await fetch(`${backendUrl}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: token.refreshToken }),
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
    };
    if (!data.access_token || !data.refresh_token) return null;

    const encoded = await encode({
      token: {
        ...token,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
      },
      secret,
      maxAge: SESSION_MAX_AGE,
    });

    return encoded;
  } catch {
    return null;
  }
}

function setSessionCookie(response: NextResponse, name: string, value: string) {
  response.cookies.set(name, value, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: name.startsWith("__Secure-"),
    maxAge: SESSION_MAX_AGE,
  });
}

/** Forwards `req` headers with an updated `cookie` header into the render. */
function forwardWithUpdatedCookies(req: NextRequest) {
  const cookie = req.cookies
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");
  const headers = new Headers(req.headers);
  headers.set("cookie", cookie);
  return NextResponse.next({ request: { headers } });
}

export async function proxy(req: NextRequest, event: NextFetchEvent) {
  const { pathname } = req.nextUrl;

  if (!req.headers.get("host")?.split(".")[0]) {
    return NextResponse.rewrite(new URL("/404", req.url));
  }

  const isPublic =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/products" ||
    pathname === "/api/refresh" ||
    pathname.startsWith("/products/");
  if (isPublic) {
    return NextResponse.next();
  }

  const cookieName = sessionCookieName();
  const refreshedCookie = await refreshSession(req);

  if (refreshedCookie) {
    // A session existed and was just rotated, so the user is authenticated.
    req.cookies.set(cookieName, refreshedCookie);
    const response = forwardWithUpdatedCookies(req);
    setSessionCookie(response, cookieName, refreshedCookie);
    return response;
  }

  return authHandler(req as NextRequestWithAuth, event);
}

export default proxy;

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)",
  ],
};
