"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "../ui/card";
import { IProduct } from "@/api/productsApi";
import { useCurrency } from "@/components/currency/currency-provider";
import { formatMoney } from "@/lib/money";

export function ProductItem(product: IProduct) {
  const router = useRouter();
  const currency = useCurrency();
  const imageUrl = product.images[0]?.url;
  const soldOut = product.stock <= 0;

  return (
    <Card
      onClick={() => router.push(`/products/${product.id}`)}
      className="group cursor-pointer overflow-hidden p-0 transition-all duration-200 hover:-translate-y-1 hover:ring-primary/40"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-muted">
        {imageUrl ? (
          <Image
            loading="lazy"
            src={imageUrl}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
            No image
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-primary px-3 py-1 text-sm font-semibold text-primary-foreground shadow">
          {formatMoney(product.price, currency)}
        </span>
        {soldOut && (
          <span className="absolute right-3 top-3 rounded-full bg-destructive/90 px-3 py-1 text-xs font-medium text-destructive-foreground">
            Sold out
          </span>
        )}
      </div>
      <CardContent className="flex flex-col gap-1 pb-4 pt-3">
        <p className="line-clamp-1 font-medium">{product.name}</p>
        <p className="line-clamp-1 text-xs text-muted-foreground">
          {product.category?.name ?? "Uncategorized"}
        </p>
      </CardContent>
    </Card>
  );
}
