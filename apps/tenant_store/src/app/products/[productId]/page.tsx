import { getProductById, type IProduct } from "@/api/productsApi";
import { apiClient } from "@/api/apiClient";
import ApiErrorFallback from "@/components/ApiErrorFallback";
import AddToCart from "@/components/products/AddToCart";
import ProductGallery from "@/components/products/ProductGallery";
import { ProductsSlider } from "@/components/products/products_slider";
import { buttonVariants } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { getStoreInfo } from "@/lib/tenant";
import { cn } from "@/lib/utils";
import { BrushCleaning } from "lucide-react";
import Link from "next/link";
import { toApiError } from "@/api/handelError";

function StockBadge({ stock }: { stock: number }) {
  const soldOut = stock <= 0;
  return (
    <span
      className={
        soldOut
          ? "rounded-full bg-destructive/15 px-3 py-1 text-sm font-medium text-destructive"
          : "rounded-full bg-primary/15 px-3 py-1 text-sm font-medium text-primary"
      }
    >
      {soldOut ? "Sold out" : `${stock} in stock`}
    </span>
  );
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const id = Number(productId);

  let product: IProduct | null = null;
  let loadError: string | null = null;
  if (productId && !Number.isNaN(id)) {
    try {
      product = await getProductById(id, undefined, apiClient);
    } catch (error) {
      const { statusCode, message } = toApiError(error);
      if (statusCode === 404) {
        product = null;
      } else {
        loadError = message;
      }
    }
  }

  if (loadError) {
    return (
      <ApiErrorFallback
        title="Couldn't load this product"
        message={loadError}
      />
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-24">
        <BrushCleaning size={200} className="text-muted-foreground/40" />
        <p className="text-2xl">Product not found</p>
        <Link href="/products" className="text-primary hover:underline">
          Browse products
        </Link>
      </div>
    );
  }

  const store = await getStoreInfo();

  return (
    <div className="flex flex-col gap-12">
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Home
        </Link>
        <span>/</span>
        <Link href="/products" className="hover:text-foreground">
          Products
        </Link>
        <span>/</span>
        <span className="line-clamp-1 text-foreground">{product.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2">
        <ProductGallery images={product.images} name={product.name} />

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-primary">
              {product.category?.name ?? "Uncategorized"}
            </p>
            <h1 className="text-3xl font-bold tracking-tight">
              {product.name}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold text-primary">
              {formatMoney(product.price, store?.currency)}
            </span>
            <StockBadge stock={product.stock} />
          </div>

          <p className="text-muted-foreground">
            {product.description || "No description provided."}
          </p>

          <div className="rounded-3xl border border-border bg-card p-5">
            <AddToCart product={product} />
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground">SKU</dt>
              <dd className="font-medium">{product.sku}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Availability</dt>
              <dd className="font-medium">
                {product.isActive ? "Active" : "Inactive"}
              </dd>
            </div>
          </dl>

          <Link
            href="/products"
            className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
          >
            Continue shopping
          </Link>
        </div>
      </div>

      <section className="flex flex-col gap-5">
        <h2 className="text-2xl font-bold tracking-tight">Related items</h2>
        <ProductsSlider />
      </section>
    </div>
  );
}
