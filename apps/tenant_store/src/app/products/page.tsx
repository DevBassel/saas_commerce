import { apiClient } from "@/api/apiClient";
import { toApiError } from "@/api/handelError";
import { getProductPage, type IProduct } from "@/api/productsApi";
import ApiErrorFallback from "@/components/ApiErrorFallback";
import CatalogGrid from "@/components/products/CatalogGrid";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";

const PAGE_SIZE = 12;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const parsedPage = Number(pageParam);
  const page =
    Number.isInteger(parsedPage) && parsedPage >= 1 ? parsedPage : 1;

  let products: IProduct[] = [];
  let total = 0;
  let pageCount = 1;
  let loadError: string | null = null;

  try {
    const result = await getProductPage(
      { page, limit: PAGE_SIZE },
      undefined,
      apiClient,
    );
    products = result.data;
    total = result.total;
    pageCount = Math.max(Math.ceil(result.total / result.limit), 1);
  } catch (error) {
    loadError = toApiError(error).message;
  }

  const hasPrevious = page > 1;
  const hasNext = page < pageCount;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Products</h1>
        {!loadError && (
          <p className="text-muted-foreground">
            {total} {total === 1 ? "item" : "items"} available
          </p>
        )}
      </header>
      {loadError ? (
        <ApiErrorFallback title="Couldn't load products" message={loadError} />
      ) : (
        <>
          <CatalogGrid products={products} />
          {pageCount > 1 && (
            <nav
              role="navigation"
              aria-label="pagination"
              className="mx-auto flex w-full items-center justify-center gap-2"
            >
              {hasPrevious ? (
                <Link
                  href={`/products?page=${page - 1}`}
                  aria-label="Go to previous page"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Previous
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "pointer-events-none opacity-50",
                  )}
                >
                  Previous
                </span>
              )}
              <span className="px-3 text-sm text-muted-foreground">
                Page {page} of {pageCount}
              </span>
              {hasNext ? (
                <Link
                  href={`/products?page=${page + 1}`}
                  aria-label="Go to next page"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Next
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "pointer-events-none opacity-50",
                  )}
                >
                  Next
                </span>
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
