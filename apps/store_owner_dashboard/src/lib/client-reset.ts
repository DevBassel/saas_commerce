/**
 * Discards all in-memory SPA state, including the React Query cache.
 *
 * The dashboard cannot reach Refine's QueryClient without adding
 * `@tanstack/react-query` as a direct dependency, so a full-page navigation is
 * used to guarantee no prior-tenant data survives a logout or a tenant switch.
 * The backend remains the security boundary; this only prevents stale cached
 * rows from being shown in the UI.
 */
export const resetClientState = (url?: string): void => {
  if (typeof window === "undefined") return;
  if (url) {
    window.location.assign(url);
  } else {
    window.location.reload();
  }
};
