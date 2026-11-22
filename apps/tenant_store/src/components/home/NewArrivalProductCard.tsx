"use client";

import type { IProduct } from "@/api/productsApi";
import { useCurrency } from "@/components/currency/currency-provider";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/money";
import { TenantLink } from "@/lib/tenant/nav";
import { PackageOpen } from "lucide-react";
import Image from "next/image";

export function NewArrivalProductCard({ product }: { product: IProduct }) {
  const currency = useCurrency();
  const href = `/products/${product.id}`;
  const imageUrl = product.images[0]?.url;
  const soldOut = product.stock <= 0;

  return (
    <Card className="group h-full gap-0 overflow-hidden rounded-2xl bg-card p-0 shadow-sm ring-1 ring-border/70 transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5 hover:ring-primary/30 motion-reduce:transform-none motion-reduce:transition-none dark:shadow-none">
      <TenantLink
        href={href}
        aria-label={`View ${product.name}`}
        className="relative block aspect-[4/5] overflow-hidden bg-muted"
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04] motion-reduce:transition-none"
          />
        ) : (
          <span className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <PackageOpen className="size-7" aria-hidden="true" />
            <span className="text-xs">No image</span>
          </span>
        )}

        <span className="absolute left-2 top-2 rounded-full bg-primary px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-primary-foreground shadow-sm sm:left-3 sm:top-3">
          New Arrival
        </span>
        {soldOut && (
          <span className="absolute bottom-2 right-2 rounded-full bg-background/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-foreground backdrop-blur-sm sm:bottom-3 sm:right-3">
            Sold out
          </span>
        )}
      </TenantLink>

      <CardContent className="flex flex-1 flex-col px-3 pb-4 pt-3 sm:px-4 sm:pb-5 sm:pt-4">
        <p className="mb-1 truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground sm:text-xs">
          {product.category?.name ?? "Latest collection"}
        </p>
        <TenantLink
          href={href}
          className="line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-card-foreground transition-colors hover:text-primary sm:text-base"
        >
          {product.name}
        </TenantLink>
        <p className="mt-3 text-sm font-bold text-primary sm:text-base">
          {formatMoney(product.price, currency)}
        </p>
      </CardContent>
    </Card>
  );
}
