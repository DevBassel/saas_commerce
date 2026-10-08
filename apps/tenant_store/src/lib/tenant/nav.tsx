"use client";

/**
 * Client-side tenant navigation primitives.
 *
 * The active tenant slug is provided once by the tenant layout (from the
 * trusted `x-tenant-slug` request header the proxy sets), so client components
 * do not need to re-derive it from the host or the query string and SSR/hydration
 * agree on the rendered links.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  forwardRef,
  useContext,
  useMemo,
  type ComponentProps,
  type ReactNode,
} from "react";
import { withTenantParam } from "./url";

const TenantSlugContext = createContext<string | null>(null);

export function TenantSlugProvider({
  slug,
  children,
}: {
  slug: string | null;
  children: ReactNode;
}) {
  return (
    <TenantSlugContext.Provider value={slug}>
      {children}
    </TenantSlugContext.Provider>
  );
}

/**
 * The tenant slug to keep in the URL, or `null` when the parameter must not be
 * added (subdomain mode, or a platform request).
 */
export const useTenantParam = (): string | null => useContext(TenantSlugContext);

/** `next/link` that appends the current tenant parameter to its `href`. */
export const TenantLink = forwardRef<
  HTMLAnchorElement,
  ComponentProps<typeof Link>
>(function TenantLink({ href, ...props }, ref) {
  const tenant = useTenantParam();
  const mergedHref =
    typeof href === "string" ? withTenantParam(href, tenant) : href;
  return <Link ref={ref} href={mergedHref} {...props} />;
});

/** `next/navigation`'s `useRouter` with tenant-aware `push`/`replace`. */
export function useTenantRouter() {
  const router = useRouter();
  const tenant = useTenantParam();

  // Stable identity so effects that depend on the router do not re-run on every
  // render (mirrors `useRouter`).
  return useMemo(
    () => ({
      push: (href: string, options?: Parameters<typeof router.push>[1]) =>
        router.push(withTenantParam(href, tenant), options),
      replace: (href: string, options?: Parameters<typeof router.replace>[1]) =>
        router.replace(withTenantParam(href, tenant), options),
      back: router.back,
      forward: router.forward,
      refresh: router.refresh,
      prefetch: router.prefetch,
    }),
    [router, tenant],
  );
}
