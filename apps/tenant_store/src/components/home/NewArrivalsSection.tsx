import { apiClient } from "@/api/apiClient";
import { toApiError } from "@/api/handleError";
import { getProductPage, type IProductPage } from "@/api/productsApi";
import ApiErrorFallback from "@/components/ApiErrorFallback";
import { NewArrivalProductCard } from "@/components/home/NewArrivalProductCard";
import { buttonVariants } from "@/components/ui/button";
import { withTenantParam } from "@/lib/tenant/url";
import { cn } from "@/lib/utils";
import { ArrowUpRight, PackageOpen } from "lucide-react";
import Link from "next/link";

const NEW_ARRIVALS_LIMIT = 8;

function SectionHeader({ tenantParam }: { tenantParam: string | null }) {
  return (
    <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        <h2
          id="new-arrivals-heading"
          className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
        >
          Fresh Finds, Just for You.
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
          Discover our latest arrivals, explore fresh styles, and find something
          new to love.
        </p>
      </div>

      <Link
        href={withTenantParam("/products", tenantParam)}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "w-fit shrink-0 gap-2 rounded-full border-border/80 bg-background/70 px-5 hover:border-primary/40 hover:bg-primary/10 hover:text-primary",
        )}
      >
        View All
        <ArrowUpRight className="size-4" aria-hidden="true" />
      </Link>
    </div>
  );
}

function SectionShell({ children }: { children: React.ReactNode }) {
  return (
    <section
      aria-labelledby="new-arrivals-heading"
      className="relative isolate overflow-hidden rounded-3xl border border-border/70 bg-card/45 px-4 py-8 shadow-sm dark:bg-card/30 dark:shadow-none sm:px-6 sm:py-10 lg:px-8 lg:py-12"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-32 -z-10 size-72 rounded-full bg-primary/10 blur-3xl"
      />
      {children}
    </section>
  );
}

export async function NewArrivalsSection({
  tenantParam,
}: {
  tenantParam: string | null;
}) {
  let result: IProductPage | null = null;
  let loadError: string | null = null;

  try {
    result = await getProductPage(
      {
        page: 1,
        limit: NEW_ARRIVALS_LIMIT,
        sortBy: "createdAt",
        sortOrder: "desc",
      },
      undefined,
      apiClient,
    );
  } catch (error) {
    loadError = toApiError(error).message;
  }

  if (loadError) {
    return (
      <SectionShell>
        <SectionHeader tenantParam={tenantParam} />
        <div className="relative mt-8">
          <ApiErrorFallback
            compact
            title="Couldn't load new arrivals"
            message={loadError}
          />
        </div>
      </SectionShell>
    );
  }

  const products = result?.data ?? [];

  return (
    <SectionShell>
      <SectionHeader tenantParam={tenantParam} />

      {products.length > 0 ? (
        <div className="relative mt-8 grid min-w-0 grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-5 md:grid-cols-3 xl:grid-cols-4">
          {products.map((product) => (
            <NewArrivalProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="relative mt-8 flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-background/40 px-5 text-center">
          <span className="mb-4 rounded-full bg-primary/10 p-3 text-primary">
            <PackageOpen className="size-6" aria-hidden="true" />
          </span>
          <h3 className="text-lg font-semibold">Nothing New Just Yet.</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            We&apos;re preparing something new. Check back soon!
          </p>
        </div>
      )}
    </SectionShell>
  );
}

export function NewArrivalsSkeleton({
  tenantParam,
}: {
  tenantParam: string | null;
}) {
  return (
    <SectionShell>
      <SectionHeader tenantParam={tenantParam} />
      <div
        aria-label="Loading new arrivals"
        aria-busy="true"
        className="relative mt-8 grid min-w-0 grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-5 md:grid-cols-3 xl:grid-cols-4"
      >
        {Array.from({ length: NEW_ARRIVALS_LIMIT }, (_, index) => (
          <div
            key={index}
            className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-border/70"
          >
            <div className="aspect-[4/5] animate-pulse bg-muted motion-reduce:animate-none" />
            <div className="space-y-3 p-3 sm:p-4">
              <div className="h-2.5 w-2/5 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
              <div className="h-4 w-4/5 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
              <div className="h-4 w-1/3 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
            </div>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}
