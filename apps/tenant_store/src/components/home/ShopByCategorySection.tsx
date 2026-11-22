import { apiClient } from "@/api/apiClient";
import {
  getStoreCategoryOptions,
  type IStoreCategoryOption,
} from "@/api/categoriesApi";
import { toApiError } from "@/api/handleError";
import { getProductPage } from "@/api/productsApi";
import ApiErrorFallback from "@/components/ApiErrorFallback";
import { buttonVariants } from "@/components/ui/button";
import { withTenantParam } from "@/lib/tenant/url";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ImageIcon, Shapes } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const CATEGORY_LIMIT = 8;

interface CategoryCardData extends IStoreCategoryOption {
  description: string | null;
  imageUrl: string | null;
  productCount: number | null;
}

function SectionHeader({ tenantParam }: { tenantParam: string | null }) {
  return (
    <div className="flex flex-col gap-6 border-b border-border/70 pb-7 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-primary">
          <Shapes className="size-4" aria-hidden="true" />
          EXPLORE COLLECTIONS
        </div>
        <h2
          id="shop-by-category-heading"
          className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
        >
          Find Your Perfect Match.
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
          Explore our collections and discover products selected to match your
          style, needs, and everyday lifestyle.
        </p>
      </div>

      <Link
        href={withTenantParam("/products", tenantParam)}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "w-fit shrink-0 gap-2 rounded-full border-border/80 bg-background px-5 hover:border-primary/40 hover:bg-primary/10 hover:text-primary",
        )}
      >
        View All Categories
        <ArrowUpRight className="size-4" aria-hidden="true" />
      </Link>
    </div>
  );
}

function SectionShell({ children }: { children: React.ReactNode }) {
  return (
    <section aria-labelledby="shop-by-category-heading" className="py-2 sm:py-4">
      {children}
    </section>
  );
}

function CategoryCard({
  category,
  tenantParam,
}: {
  category: CategoryCardData;
  tenantParam: string | null;
}) {
  const href = withTenantParam(
    `/products?categoryId=${category.id}`,
    tenantParam,
  );
  const countLabel =
    category.productCount === null
      ? null
      : `${category.productCount} ${category.productCount === 1 ? "product" : "products"}`;

  return (
    <Link
      href={href}
      aria-label={`Explore ${category.name}`}
      className="group relative isolate aspect-[3/4] min-w-0 overflow-hidden rounded-3xl bg-muted shadow-sm ring-1 ring-border/70 transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/50 motion-reduce:transform-none motion-reduce:transition-none dark:shadow-none sm:aspect-[4/5]"
    >
      {category.imageUrl ? (
        <Image
          src={category.imageUrl}
          alt=""
          fill
          sizes="(max-width: 767px) 50vw, (max-width: 1279px) 33vw, 25vw"
          className="object-cover transition-transform duration-700 group-hover:scale-105 motion-reduce:transition-none"
        />
      ) : (
        <div className="absolute inset-0 overflow-hidden bg-linear-to-br from-primary/35 via-card to-muted">
          <span className="absolute -right-5 -top-8 select-none text-[9rem] font-black leading-none text-foreground/5 dark:text-white/5">
            {category.name.charAt(0).toUpperCase()}
          </span>
          <ImageIcon
            className="absolute left-1/2 top-[38%] size-9 -translate-x-1/2 -translate-y-1/2 text-primary/70 sm:size-11"
            aria-hidden="true"
          />
        </div>
      )}

      <div
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-t from-black/95 via-black/40 to-black/5 transition-colors duration-300 group-hover:via-black/50"
      />

      {countLabel ? (
        <span className="absolute right-3 top-3 rounded-full border border-white/15 bg-black/35 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/90 backdrop-blur-md sm:right-4 sm:top-4 sm:text-xs">
          {countLabel}
        </span>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 flex flex-col p-4 text-white sm:p-5">
        <h3 className="line-clamp-2 text-base font-bold leading-tight tracking-tight sm:text-xl">
          {category.name}
        </h3>
        {category.description ? (
          <p className="mt-2 hidden text-sm leading-5 text-white/70 sm:line-clamp-2">
            {category.description}
          </p>
        ) : null}
        <span className="mt-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-300 sm:mt-4">
          <span className="hidden sm:inline">Explore Category</span>
          <ArrowUpRight
            className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none"
            aria-hidden="true"
          />
        </span>
      </div>
    </Link>
  );
}

async function enrichCategory(
  category: IStoreCategoryOption,
): Promise<CategoryCardData> {
  try {
    const result = await getProductPage(
      { page: 1, limit: 1, categoryId: category.id },
      undefined,
      apiClient,
    );
    const product = result.data[0];

    return {
      ...category,
      description: product?.category?.description?.trim() || null,
      imageUrl: product?.images[0]?.url ?? null,
      productCount: result.total,
    };
  } catch {
    return {
      ...category,
      description: null,
      imageUrl: null,
      productCount: null,
    };
  }
}

export async function ShopByCategorySection({
  tenantParam,
}: {
  tenantParam: string | null;
}) {
  let categories: IStoreCategoryOption[];

  try {
    categories = await getStoreCategoryOptions(apiClient);
  } catch (error) {
    return (
      <SectionShell>
        <SectionHeader tenantParam={tenantParam} />
        <div className="mt-8">
          <ApiErrorFallback
            compact
            title="Couldn't load categories"
            message={toApiError(error).message}
          />
        </div>
      </SectionShell>
    );
  }

  const visibleCategories = categories.slice(0, CATEGORY_LIMIT);
  const categoryCards = await Promise.all(
    visibleCategories.map(enrichCategory),
  );

  return (
    <SectionShell>
      <SectionHeader tenantParam={tenantParam} />

      {categoryCards.length > 0 ? (
        <div className="mt-8 grid min-w-0 grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
          {categoryCards.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              tenantParam={tenantParam}
            />
          ))}
        </div>
      ) : (
        <div className="mt-8 flex min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-muted/30 px-5 text-center">
          <span className="mb-4 rounded-full bg-primary/10 p-3 text-primary">
            <Shapes className="size-6" aria-hidden="true" />
          </span>
          <h3 className="text-lg font-semibold">Discover Something New.</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Our collections are being prepared. Check back soon.
          </p>
        </div>
      )}
    </SectionShell>
  );
}

export function ShopByCategorySkeleton({
  tenantParam,
}: {
  tenantParam: string | null;
}) {
  return (
    <SectionShell>
      <SectionHeader tenantParam={tenantParam} />
      <div
        aria-busy="true"
        aria-live="polite"
        role="status"
        className="mt-8 grid min-w-0 grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4"
      >
        <span className="sr-only">Loading categories</span>
        {Array.from({ length: CATEGORY_LIMIT }, (_, index) => (
          <div
            key={index}
            aria-hidden="true"
            className="aspect-[3/4] animate-pulse rounded-3xl bg-muted shadow-sm ring-1 ring-border/70 motion-reduce:animate-none sm:aspect-[4/5]"
          />
        ))}
      </div>
    </SectionShell>
  );
}
