import { apiClient } from "@/api/apiClient";
import { toApiError } from "@/api/handelError";
import { getProducts, type IProduct } from "@/api/productsApi";
import ApiErrorFallback from "@/components/ApiErrorFallback";
import CatalogGrid from "@/components/products/CatalogGrid";

export default async function ProductsPage() {
  let products: IProduct[] = [];
  let loadError: string | null = null;

  try {
    products = await getProducts(undefined, apiClient);
  } catch (error) {
    loadError = toApiError(error).message;
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Products</h1>
        {!loadError && (
          <p className="text-muted-foreground">
            {products.length} {products.length === 1 ? "item" : "items"}{" "}
            available
          </p>
        )}
      </header>
      {loadError ? (
        <ApiErrorFallback title="Couldn't load products" message={loadError} />
      ) : (
        <CatalogGrid products={products} />
      )}
    </div>
  );
}
