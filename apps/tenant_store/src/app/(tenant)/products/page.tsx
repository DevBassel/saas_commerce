import axios from "axios";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import {
  getStoreCategoryOptions,
  type IStoreCategoryOption,
} from "@/api/categoriesApi";
import { toApiError } from "@/api/handleError";
import { getProductPage, type IProductPage } from "@/api/productsApi";
import ApiErrorFallback from "@/components/ApiErrorFallback";
import ActiveFilterChips from "@/components/products/ActiveFilterChips";
import CatalogGrid from "@/components/products/CatalogGrid";
import ProductFilters from "@/components/products/ProductFilters";
import { FilterNavigationProvider } from "@/components/products/filter-navigation";
import Pagination from "@/components/shared/Pagination";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import {
  PRODUCTS_PAGE_SIZE,
  draftFromFilters,
  draftFromSearchParams,
  parseProductSearchParams,
  serializeProductFilters,
  type CatalogPriceRange,
  type ProductFilters as ProductFilterValues,
} from "@/lib/product-filters";
import { getTenantParam, getTenantSlugFromHost } from "@/lib/tenant";
import { withTenantParam } from "@/lib/tenant/url";
import Link from "next/link";
import { PackageOpen, TriangleAlert } from "lucide-react";

type ProductOutcome =
  | { status: "ok"; result: IProductPage }
  | { status: "error"; message: string }
  | { status: "skipped" };

type CategoryOutcome =
  | { status: "ok"; categories: IStoreCategoryOption[] }
  | { status: "error"; message: string };

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const requestHeaders = await headers();
  const tenantSlug =
    requestHeaders.get("x-tenant-slug") ??
    getTenantSlugFromHost(requestHeaders.get("host"));

  if (!tenantSlug) notFound();

  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (!baseUrl) {
    return (
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Products</h1>
        </header>
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Storefront is unavailable</AlertTitle>
          <AlertDescription>
            The store backend URL is not configured.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const parsed = parseProductSearchParams(raw);
  const initialDraft = parsed.filters
    ? draftFromFilters(parsed.filters)
    : draftFromSearchParams(raw);
  const tenantParam = await getTenantParam();

  // Request-scoped anonymous client: only the trusted tenant header, never a
  // session token, cookie, or client-supplied tenant identifier.
  const publicClient = axios.create({
    baseURL: baseUrl,
    timeout: 15000,
    headers: {
      "Content-Type": "application/json",
      "x-tenant-slug": tenantSlug,
    },
  });

  const filters = parsed.filters;
  const productRequest: Promise<ProductOutcome> = filters
    ? getProductPage(
        {
          page: parsed.page,
          limit: PRODUCTS_PAGE_SIZE,
          search: filters.search,
          categoryId: filters.categoryId,
          minPrice: filters.minPrice,
          maxPrice: filters.maxPrice,
          inStock: filters.inStock,
          sortBy: filters.sortBy,
          sortOrder: filters.sortOrder,
        },
        undefined,
        publicClient,
      ).then(
        (result) => ({ status: "ok" as const, result }),
        (error: unknown) => ({
          status: "error" as const,
          message: toApiError(error).message,
        }),
      )
    : Promise.resolve({ status: "skipped" as const });

  const categoryRequest: Promise<CategoryOutcome> = getStoreCategoryOptions(
    publicClient,
  ).then(
    (categories) => ({ status: "ok" as const, categories }),
    (error: unknown) => ({
      status: "error" as const,
      message: toApiError(error).message,
    }),
  );

  // A single price-sorted product supplies the full tenant catalog ceiling,
  // independently of the shopper's current filters and visible result page.
  const priceRangeRequest: Promise<CatalogPriceRange> = getProductPage(
    { page: 1, limit: 1, sortBy: "price", sortOrder: "desc" },
    undefined,
    publicClient,
  )
    .then((page): CatalogPriceRange => {
      if (page.total === 0 && page.data.length === 0)
        return { status: "empty" };
      const maxPrice = page.data[0]?.price;
      if (
        typeof maxPrice !== "number" ||
        !Number.isFinite(maxPrice) ||
        maxPrice < 0
      ) {
        return {
          status: "error",
          message: "The catalog price range is unavailable.",
        };
      }
      return { status: "ready", maxPrice };
    })
    .catch(
      (error: unknown): CatalogPriceRange => ({
        status: "error",
        message: toApiError(error).message,
      }),
    );

  const [productOutcome, categoryOutcome, priceRange] = await Promise.all([
    productRequest,
    categoryRequest,
    priceRangeRequest,
  ]);

  const categories =
    categoryOutcome.status === "ok" ? categoryOutcome.categories : [];
  const categoryError =
    categoryOutcome.status === "error" ? categoryOutcome.message : null;

  const filterKey = JSON.stringify([
    tenantSlug,
    parsed.page,
    parsed.filters,
    parsed.filters ? null : initialDraft,
  ]);

  const clearAllHref = withTenantParam("/products", tenantParam);
  const result = productOutcome.status === "ok" ? productOutcome.result : null;
  const pageCount = result
    ? Math.max(Math.ceil(result.total / result.limit), 1)
    : 1;
  const outOfRange =
    result != null && result.total > 0 && result.page > pageCount;

  const firstPageHref = (values: ProductFilterValues) => {
    const params = new URLSearchParams(serializeProductFilters(values));
    const query = params.toString();
    return withTenantParam(
      query ? `/products?${query}` : "/products",
      tenantParam,
    );
  };

  const summary =
    result != null
      ? `${result.total} ${
          result.total === 1 ? "item" : "items"
        } ${parsed.hasActiveFilters ? "matching your filters" : "available"}`
      : productOutcome.status === "skipped"
        ? "Fix the filter values below to see results."
        : null;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Products</h1>
        {summary && (
          <p aria-live="polite" className="text-muted-foreground">
            {summary}
          </p>
        )}
      </header>

      <FilterNavigationProvider>
        <div className="flex min-w-0 flex-col gap-8">
          <ProductFilters
            key={filterKey}
            categories={categories}
            categoryError={categoryError}
            priceRange={priceRange}
            initialDraft={initialDraft}
            initialErrors={parsed.errors}
            hasActiveFilters={parsed.hasActiveFilters}
          />

          <section
            aria-label="Product results"
            className="flex min-w-0 flex-col gap-8"
          >
            <ActiveFilterChips
              categories={categories}
              appliedFilters={parsed.filters}
            />

            {productOutcome.status === "skipped" && (
              <Alert variant="destructive">
                <TriangleAlert />
                <AlertTitle>Invalid filter values</AlertTitle>
                <AlertDescription>
                  Correct the highlighted fields and apply your filters again.
                </AlertDescription>
              </Alert>
            )}

            {productOutcome.status === "error" && (
              <ApiErrorFallback
                title="Couldn't load products"
                message={productOutcome.message}
              />
            )}

            {result != null && outOfRange && filters && (
              <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border px-4 py-20 text-center">
                <PackageOpen className="size-10 text-muted-foreground" />
                <p className="text-lg font-medium">
                  That page is past the results
                </p>
                <p className="text-sm text-muted-foreground">
                  Page {result.page} does not exist for these filters.
                </p>
                <Link
                  href={firstPageHref(filters)}
                  className={buttonVariants({ variant: "outline" })}
                >
                  Back to first page
                </Link>
              </div>
            )}

            {result != null && !outOfRange && result.data.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border px-4 py-20 text-center">
                <PackageOpen className="size-10 text-muted-foreground" />
                <p className="text-lg font-medium">
                  {parsed.hasActiveFilters
                    ? "No products match these filters"
                    : "No products available yet"}
                </p>
                {parsed.hasActiveFilters && (
                  <Link
                    href={clearAllHref}
                    className={buttonVariants({ variant: "outline" })}
                  >
                    Clear all filters
                  </Link>
                )}
              </div>
            )}

            {result != null && !outOfRange && result.data.length > 0 && (
              <>
                <CatalogGrid products={result.data} />
                <Pagination
                  basePath="/products"
                  page={result.page}
                  pageCount={pageCount}
                  queryParams={
                    filters ? serializeProductFilters(filters) : undefined
                  }
                />
              </>
            )}

            {parsed.filters == null && (
              <p className="text-sm text-muted-foreground">
                <Link
                  href={clearAllHref}
                  className="underline underline-offset-4"
                >
                  Clear all filters
                </Link>{" "}
                to return to the full catalog.
              </p>
            )}
          </section>
        </div>
      </FilterNavigationProvider>
    </div>
  );
}
