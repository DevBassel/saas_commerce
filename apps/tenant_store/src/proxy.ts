import { jwtDecode } from "jwt-decode";
import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { encodeRotatedSession, requestTokenRotation } from "@/lib/auth/refresh";
import {
  sessionCookieName,
  sessionCookieOptions,
} from "@/lib/auth/session-cookie";
import {
  allowSubdomain,
  classifyHost,
  resolveTenantSlug,
} from "@/lib/tenant/host";

const secret = process.env.NEXTAUTH_SECRET;

/** Platform-only routes; never rendered on a tenant host. */
const PLATFORM_PATHS = new Set(["/home", "/plans", "/register-store"]);

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
 * Request headers to forward into the render, with the trusted tenant signal.
 *
 * Any client-supplied `x-tenant-slug` is overwritten (tenant) or removed
 * (platform/invalid) so downstream server code can trust the header.
 */
function forwardedHeaders(req: NextRequest, slug: string | null): Headers {
  const headers = new Headers(req.headers);
  if (slug) {
    headers.set("x-tenant-slug", slug);
  } else {
    headers.delete("x-tenant-slug");
  }
  return headers;
}

/** Adds `?tenant=<slug>` to a tenant-context redirect when subdomain mode is off. */
function withTenantRedirectParam(url: URL, slug: string | null): URL {
  if (!allowSubdomain() && slug) {
    url.searchParams.set("tenant", slug);
  }
  return url;
}

type RefreshOutcome =
  | { status: "skipped" }
  | { status: "refreshed"; cookie: string }
  | { status: "failed" };

/**
 * Rotates the NextAuth session when the backend access token has expired.
 *
 * Server Components cannot write cookies, so a refresh attempted during render
 * could not persist the rotated refresh token (the backend invalidates the old
 * one via its `jti`). Refreshing here, before render, lets us both persist the
 * cookie on the response and forward it to the current request so
 * `getServerSession()` sees the fresh tokens.
 *
 * Returns `skipped` when no refresh is needed, `refreshed` with the re-encoded
 * cookie, or `failed` when an expired token could not be rotated (the caller
 * then signs the user out).
 */
async function refreshSession(req: NextRequest): Promise<RefreshOutcome> {
  if (!secret) return { status: "skipped" };

  const token = await getToken({ req, secret });
  if (!token?.refreshToken || !isAccessTokenExpired(token.accessToken)) {
    return { status: "skipped" };
  }

  const rotation = await requestTokenRotation(token.refreshToken);
  if (!rotation.ok) return { status: "failed" };

  const cookie = await encodeRotatedSession(token, rotation, secret);
  return { status: "refreshed", cookie };
}

function setSessionCookie(response: NextResponse, name: string, value: string) {
  response.cookies.set(name, value, sessionCookieOptions(name));
}

/**
 * Clears the session cookie (and any chunked variants) so a rotated-away
 * refresh token cannot leave the browser in a half-authenticated state.
 */
function clearSessionCookie(
  response: NextResponse,
  req: NextRequest,
  name: string,
) {
  response.cookies.delete(name);
  for (const { name: cookieName } of req.cookies.getAll()) {
    if (cookieName.startsWith(`${name}.`)) {
      response.cookies.delete(cookieName);
    }
  }
}

/** Forwards `req` headers with an updated `cookie` header into the render. */
function forwardWithUpdatedCookies(req: NextRequest, headers: Headers) {
  const cookie = req.cookies
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");
  headers.set("cookie", cookie);
  return NextResponse.next({ request: { headers } });
}

/** Redirects to sign-in, preserving the attempted path and (when param mode) tenant. */
function loginRedirect(
  req: NextRequest,
  pathname: string,
  slug: string | null,
): NextResponse {
  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("callbackUrl", `${pathname}${req.nextUrl.search}`);
  return NextResponse.redirect(withTenantRedirectParam(loginUrl, slug));
}

/**
 * Platform host (the root apex or `www.`): serves the landing, plans and
 * store-registration pages. No tenant is ever resolved here, so tenant-only
 * paths are redirected back to the platform home rather than leaking a
 * storefront. Any incoming `x-tenant-slug` is stripped.
 */
function handlePlatform(req: NextRequest, pathname: string): NextResponse {
  const headers = forwardedHeaders(req, null);

  if (pathname === "/") {
    // The platform landing lives at the internal segment `/home` because a
    // tenant `/` already exists; the rewrite keeps the public URL as `/`.
    return NextResponse.rewrite(new URL("/home", req.url), {
      request: { headers },
    });
  }
  if (PLATFORM_PATHS.has(pathname)) {
    return NextResponse.next({ request: { headers } });
  }
  return NextResponse.redirect(new URL("/", req.url));
}

/**
 * Tenant host (a single-label subdomain of the root, or the apex with a valid
 * `?tenant=` when subdomain mode is off): the storefront. Platform paths are
 * redirected to the storefront home. Public paths pass through with the
 * resolved `x-tenant-slug` injected; everything else keeps the existing
 * refresh-then-auth protection.
 */
async function handleTenant(
  req: NextRequest,
  pathname: string,
  slug: string,
): Promise<NextResponse> {
  const headers = forwardedHeaders(req, slug);

  if (PLATFORM_PATHS.has(pathname)) {
    return NextResponse.redirect(
      withTenantRedirectParam(new URL("/", req.url), slug),
    );
  }

  const isPublic =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/verify-email" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/products" ||
    pathname === "/api/refresh" ||
    pathname.startsWith("/products/");
  if (isPublic) {
    return NextResponse.next({ request: { headers } });
  }

  // Proactively keep unverified accounts on the verification page. The backend
  // `EmailVerifiedGuard` rejects every authenticated tenant route with
  // `403 EMAIL_NOT_VERIFIED`, so redirecting before render (the `verified` flag
  // is carried in the NextAuth session) avoids a page that would error on its
  // data calls. `/verify-email` is public, so this cannot loop.
  if (secret) {
    const sessionToken = await getToken({ req, secret });
    if (sessionToken?.verified === false) {
      return NextResponse.redirect(
        withTenantRedirectParam(new URL("/verify-email", req.url), slug),
      );
    }
  }

  const cookieName = sessionCookieName();
  const outcome = await refreshSession(req);

  if (outcome.status === "refreshed") {
    // A session existed and was just rotated, so the user is authenticated.
    req.cookies.set(cookieName, outcome.cookie);
    const response = forwardWithUpdatedCookies(req, headers);
    setSessionCookie(response, cookieName, outcome.cookie);
    return response;
  }

  if (outcome.status === "failed") {
    // The access token expired and the refresh token could not be rotated
    // (invalid/revoked, or the backend rejected it). Drop the session and send
    // the user back through sign-in instead of serving a half-authenticated
    // page that will 401 on every data call.
    const response = loginRedirect(req, pathname, slug);
    clearSessionCookie(response, req, cookieName);
    return response;
  }

  // No refresh needed: require a session, exactly as the previous NextAuth
  // middleware did (token present -> continue, otherwise sign in).
  if (secret && !(await getToken({ req, secret }))) {
    return loginRedirect(req, pathname, slug);
  }

  return NextResponse.next({ request: { headers } });
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = req.headers.get("host");
  const classification = classifyHost(host);

  if (classification.kind === "invalid") {
    // A host that is not the platform root or one of its subdomains. Rewrite to
    // the `/404` route so a real 404 status and the not-found page are rendered.
    return NextResponse.rewrite(new URL("/404", req.url), {
      request: { headers: forwardedHeaders(req, null) },
    });
  }

  const slug = resolveTenantSlug(host, req.nextUrl.searchParams);
  if (slug) {
    return handleTenant(req, pathname, slug);
  }

  return handlePlatform(req, pathname);
}

export default proxy;

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml).*)",
  ],
};
