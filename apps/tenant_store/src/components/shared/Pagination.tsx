"use client";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTenantParam } from "@/lib/tenant/nav";
import { withTenantParam } from "@/lib/tenant/url";
import Link from "next/link";

interface PaginationProps {
  /** Base route, e.g. `/products`; the page number is appended as `?page=`. */
  basePath: string;
  page: number;
  pageCount: number;
  /** Extra committed query parameters to preserve while paging. */
  queryParams?: Record<string, string>;
}

/**
 * Shared prev/next pager used by `/products` and `/orders`. Renders nothing
 * when there is a single page. The active tenant parameter is merged in so
 * paging never drops the tenant in `?tenant=` mode.
 */
export default function Pagination({
  basePath,
  page,
  pageCount,
  queryParams,
}: PaginationProps) {
  const tenantParam = useTenantParam();

  if (pageCount <= 1) return null;

  const hasPrevious = page > 1;
  const hasNext = page < pageCount;
  const disabledClass = cn(
    buttonVariants({ variant: "outline", size: "sm" }),
    "pointer-events-none opacity-50",
  );

  const pageHref = (targetPage: number): string => {
    const params = new URLSearchParams(queryParams);
    params.set("page", String(targetPage));
    return withTenantParam(`${basePath}?${params.toString()}`, tenantParam);
  };

  return (
    <nav
      role="navigation"
      aria-label="pagination"
      className="mx-auto flex w-full items-center justify-center gap-2"
    >
      {hasPrevious ? (
        <Link
          href={pageHref(page - 1)}
          aria-label="Go to previous page"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Previous
        </Link>
      ) : (
        <span aria-disabled="true" className={disabledClass}>
          Previous
        </span>
      )}
      <span className="px-3 text-sm text-muted-foreground">
        Page {page} of {pageCount}
      </span>
      {hasNext ? (
        <Link
          href={pageHref(page + 1)}
          aria-label="Go to next page"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Next
        </Link>
      ) : (
        <span aria-disabled="true" className={disabledClass}>
          Next
        </span>
      )}
    </nav>
  );
}
