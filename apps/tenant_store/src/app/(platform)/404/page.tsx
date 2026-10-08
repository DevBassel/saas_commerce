import { notFound } from "next/navigation";

/**
 * Rewrite target for an invalid host (one that is neither the platform root nor
 * a subdomain of it).
 *
 * The proxy rewrites those requests to /404 so this page runs, calls
 * `notFound()`, and renders the shared `src/app/not-found.tsx` with a real 404
 * status. It lives in the `(platform)` group so it gets a root layout.
 */
export default function NotFoundRoute() {
  notFound();
}
