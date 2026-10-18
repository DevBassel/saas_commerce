"use client";

import type { ReactNode } from "react";
import { useLocation } from "react-router";

import { ErrorBoundary } from "./ErrorBoundary";

/**
 * Route-level error boundary that clears a previously rendered error when the
 * user navigates to another route. The root boundary in `App` stays as a
 * backstop for errors thrown outside the routed tree.
 *
 * Keyed by `pathname`, NOT `location.key`: Refine's `syncWithLocation` writes
 * table state to the URL with `history.replace`, and React Router mints a new
 * `location.key` on every replace even when the URL is unchanged. Keying on
 * `location.key` would remount the routed subtree on each of those replaces and
 * loop forever on list pages.
 */
export const RouteErrorBoundary = ({ children }: { children: ReactNode }) => {
  const location = useLocation();

  return <ErrorBoundary key={location.pathname}>{children}</ErrorBoundary>;
};

RouteErrorBoundary.displayName = "RouteErrorBoundary";
