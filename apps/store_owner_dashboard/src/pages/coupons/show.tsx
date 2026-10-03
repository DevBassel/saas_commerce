"use client";

import { useShow } from "@refinedev/core";

import { ShowView, ShowViewHeader } from "@/components/refine-ui/views/show-view";
import { ActiveBadge } from "@/components/refine-ui/data-table/active-badge";
import { DetailRow } from "@/components/refine-ui/views/detail-row";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { formatMoney, useTenantCurrency } from "@/lib/currency";
import { formatDiscount } from "@/lib/coupons";
import { cn } from "@/lib/utils";
import type { Coupon } from "@/types/coupon";

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : "—";

export const CouponsShow = () => {
  const { query } = useShow<Coupon>({ resource: "coupons" });
  const currency = useTenantCurrency();
  const record = query.data?.data;

  const title =
    typeof query.data?.data?.code === "string"
      ? query.data.data.code
      : undefined;

  return (
    <ShowView>
      <ShowViewHeader title={title} />
      {query.isLoading ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <Skeleton className="h-6 w-48" />
            </CardTitle>
          </CardHeader>
          <CardContent className={cn("flex", "flex-col", "gap-4")}>
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={`skeleton-row-${index}`}
                className={cn("flex", "flex-col", "gap-2")}
              >
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-64" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : !record ? (
        <p
          className={cn(
            "py-8",
            "text-center",
            "text-sm",
            "text-muted-foreground",
          )}
        >
          Coupon not found.
        </p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className={cn("flex", "items-center", "gap-2")}>
              {record.code}
              <ActiveBadge active={record.isActive} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DetailRow label="Description" value={record.description || "—"} />
            <Separator />
            <DetailRow
              label="Discount"
              value={formatDiscount(
                record.discountType,
                record.discountValue,
                currency,
              )}
            />
            <Separator />
            <DetailRow
              label="Minimum order amount"
              value={formatMoney(record.minOrderAmount, currency)}
            />
            <Separator />
            <DetailRow
              label="Maximum discount"
              value={
                record.maxDiscountAmount == null
                  ? "—"
                  : formatMoney(record.maxDiscountAmount, currency)
              }
            />
            <Separator />
            <DetailRow
              label="Usage"
              value={`${record.usageCount} used / ${
                record.usageLimit ?? "∞"
              } total / ${record.remainingUses ?? "∞"} remaining`}
            />
            <Separator />
            <DetailRow
              label="Per-user limit"
              value={record.perUserLimit ?? "Unlimited"}
            />
            <Separator />
            <DetailRow label="Starts at" value={formatDate(record.startsAt)} />
            <Separator />
            <DetailRow label="Expires at" value={formatDate(record.expiresAt)} />
            <Separator />
            <DetailRow label="Created" value={formatDate(record.createdAt)} />
            <Separator />
            <DetailRow label="Updated" value={formatDate(record.updatedAt)} />
          </CardContent>
        </Card>
      )}
    </ShowView>
  );
};

CouponsShow.displayName = "CouponsShow";
