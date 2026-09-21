"use client";

import { useShow } from "@refinedev/core";

import { ShowView, ShowViewHeader } from "@/components/refine-ui/views/show-view";
import { ActiveBadge } from "@/components/refine-ui/data-table/active-badge";
import { DetailRow } from "@/components/refine-ui/views/detail-row";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/product";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export const ProductsShow = () => {
  const { query } = useShow<Product>({ resource: "products" });
  const record = query.data?.data;

  const title =
    typeof query.data?.data?.name === "string" ? query.data.data.name : undefined;

  return (
    <ShowView>
      <ShowViewHeader title={title} />
      {query.isLoading ? (
        <div className={cn("grid", "gap-6", "lg:grid-cols-[2fr_1fr]")}>
          <Card>
            <CardHeader>
              <CardTitle>
                <Skeleton className="h-6 w-48" />
              </CardTitle>
            </CardHeader>
            <CardContent className={cn("flex", "flex-col", "gap-4")}>
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={`skeleton-row-${index}`} className={cn("flex", "flex-col", "gap-2")}>
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-64" />
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Images</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={cn("grid", "grid-cols-2", "gap-3")}>
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton
                    key={`skeleton-image-${index}`}
                    className={cn("aspect-square", "w-full")}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : !record ? (
        <p className={cn("py-8", "text-center", "text-sm", "text-muted-foreground")}>
          Product not found.
        </p>
      ) : (
        <div className={cn("grid", "gap-6", "lg:grid-cols-[2fr_1fr]")}>
          <Card>
            <CardHeader>
              <CardTitle className={cn("flex", "items-center", "gap-2")}>
                {record.name}
                <ActiveBadge active={record.isActive} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DetailRow label="SKU" value={record.sku} />
              <Separator />
              <DetailRow label="Price" value={currency.format(record.price)} />
              <Separator />
              <DetailRow label="Stock" value={record.stock} />
              <Separator />
              <DetailRow
                label="Category"
                value={record.category?.name ?? "—"}
              />
              <Separator />
              <DetailRow
                label="Description"
                value={record.description || "—"}
              />
              <Separator />
              <DetailRow
                label="Created"
                value={new Date(record.createdAt).toLocaleString()}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Images</CardTitle>
            </CardHeader>
            <CardContent>
              {record.images?.length ? (
                <div className={cn("grid", "grid-cols-2", "gap-3")}>
                  {[...record.images]
                    .sort((a, b) => a.position - b.position)
                    .map((image) => (
                      <img
                        key={image.id}
                        src={image.url}
                        alt={record.name}
                        loading="lazy"
                        decoding="async"
                        className={cn(
                          "aspect-square",
                          "w-full",
                          "rounded-md",
                          "object-cover",
                          "border"
                        )}
                      />
                    ))}
                </div>
              ) : (
                <p className={cn("text-sm", "text-muted-foreground")}>
                  No images.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </ShowView>
  );
};

ProductsShow.displayName = "ProductsShow";
