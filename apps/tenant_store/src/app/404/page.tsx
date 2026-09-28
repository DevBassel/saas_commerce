import { notFound } from "next/navigation";

/**
 * Rewrite target for requests without a store subdomain.
 *
 * The proxy rewrites those requests to /404 so this page runs, calls
 * `notFound()`, and renders `src/app/not-found.tsx` with a real 404 status.
 */
export default function NotFoundRoute() {
  notFound();
}
