import { IProduct } from "@/api/productsApi";
import { ProductItem } from "@/components/products/Product_item";

/**
 * Presentation-only product grid. Filtering, totals, and pagination are owned
 * by the server-rendered `/products` page and its URL state; this component
 * must never filter the products it receives.
 */
export default function CatalogGrid({ products }: { products: IProduct[] }) {
  if (!products.length) return null;

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-2 xl:grid-cols-3">
      {products.map((product) => (
        <ProductItem key={product.id} {...product} />
      ))}
    </div>
  );
}
