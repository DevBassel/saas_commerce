import { apiClient } from "@/api/apiClient";
import { toApiError } from "@/api/handleError";
import { getProductPage, type IProduct } from "@/api/productsApi";
import ApiErrorFallback from "@/components/ApiErrorFallback";
import CatalogGrid from "@/components/products/CatalogGrid";
import Pagination from "@/components/shared/Pagination";

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
          <Pagination
            basePath="/products"
            page={page}
            pageCount={pageCount}
          />
        </>
      )}
    </div>
  );
}
