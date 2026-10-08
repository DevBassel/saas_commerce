import { getProductById, type IProduct } from "@/api/productsApi";
import { apiClient } from "@/api/apiClient";
import { toApiError } from "@/api/handleError";
import ApiErrorFallback from "@/components/ApiErrorFallback";
import AddToCart from "@/components/products/AddToCart";
import ProductGallery from "@/components/products/ProductGallery";
import { ProductsSlider } from "@/components/products/products_slider";
import { buttonVariants } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { getStoreInfo, getTenantParam } from "@/lib/tenant";
import { withTenantParam } from "@/lib/tenant/url";
import { cn } from "@/lib/utils";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

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

/**
 * Request-scoped memo of the product read so `generateMetadata` and the page
 * body share a single backend call.
 */
const loadProduct = cache(async (id: number): Promise<IProduct | null> => {
  try {
    return await getProductById(id, undefined, apiClient);
  } catch (error) {
    if (toApiError(error).statusCode === 404) return null;
    throw error;
  }
});

async function canonicalUrl(path: string): Promise<string | undefined> {
  const host = (await headers()).get("host");
  if (!host) return undefined;
  const forwardedProto = (await headers()).get("x-forwarded-proto");
  const scheme =
    forwardedProto?.split(",")[0]?.trim() ||
    (process.env.NEXTAUTH_URL?.startsWith("https://") ? "https" : "http");
  // Keep the canonical tenant-specific in `?tenant=` mode; `null` in subdomain
  // mode so the URL is unchanged.
  const tenantParam = await getTenantParam();
  return withTenantParam(`${scheme}://${host}${path}`, tenantParam);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ productId: string }>;
}): Promise<Metadata> {
  const { productId } = await params;
  const id = Number(productId);
  if (!Number.isInteger(id) || id <= 0) return { title: "Product not found" };

  const product = await loadProduct(id);
  if (!product) return { title: "Product not found" };

  const description =
    product.description || `Shop ${product.name} from our online store.`;
  const image = product.images?.[0]?.url;
  const url = await canonicalUrl(`/products/${id}`);

  return {
    title: product.name,
    description,
    alternates: url ? { canonical: url } : undefined,
    openGraph: {
      title: product.name,
      description,
      url,
      type: "website",
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: product.name,
      description,
      images: image ? [image] : undefined,
    },
  };
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

  if (Number.isInteger(id) && id > 0) {
    try {
      product = await loadProduct(id);
    } catch (error) {
      loadError = toApiError(error).message;
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

  // Missing/invalid product is a real 404 (rendered by `not-found.tsx` with a
  // 404 status) instead of an in-page "not found" that search engines index.
  if (!product) notFound();

  const store = await getStoreInfo();
  const tenantParam = await getTenantParam();

  return (
    <div className="flex flex-col gap-12">
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href={withTenantParam("/", tenantParam)}
          className="hover:text-foreground"
        >
          Home
        </Link>
        <span>/</span>
        <Link
          href={withTenantParam("/products", tenantParam)}
          className="hover:text-foreground"
        >
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
            href={withTenantParam("/products", tenantParam)}
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
