"use client";

import { format } from "date-fns";

import { DetailRow } from "@/components/refine-ui/views/detail-row";
import { TenantStatusActions } from "@/components/tenants/tenant-status-actions";
import { TenantStatusBadge } from "@/components/tenants/tenant-status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Tenant } from "@/types/tenant";

export const TenantDetailsCard = ({
  tenant,
  onRefetch,
}: {
  tenant: Tenant;
  onRefetch?: () => void | Promise<void>;
}) => (
  <Card>
    <CardHeader>
      <div className={cn("flex", "items-center", "justify-between", "gap-4")}>
        <div className={cn("flex", "flex-col", "gap-1.5")}>
          <CardTitle className={cn("flex", "items-center", "gap-3")}>
            Details
            <TenantStatusBadge status={tenant.status} />
          </CardTitle>
          <CardDescription>Platform tenant information</CardDescription>
        </div>
        <TenantStatusActions tenant={tenant} onToggled={onRefetch} />
      </div>
    </CardHeader>
    <Separator />
    <CardContent>
      <div
        className={cn("grid", "gap-6", "sm:grid-cols-2", "lg:grid-cols-3")}
      >
        <DetailRow label="Name" value={tenant.name} />
        <DetailRow label="Slug" value={tenant.slug} />
        <DetailRow label="Schema" value={tenant.schemaName} />
        <DetailRow label="Subdomain" value={tenant.subdomain ?? "—"} />
        <DetailRow
          label="Owner User ID"
          value={tenant.ownerUserId ?? "—"}
        />
        <DetailRow label="Status" value={tenant.status} />
        <DetailRow
          label="Currency"
          value={tenant.currency?.toUpperCase() ?? "—"}
        />
        <DetailRow
          label="Created"
          value={format(new Date(tenant.createdAt), "MMM d, yyyy HH:mm")}
        />
        <DetailRow
          label="Updated"
          value={format(new Date(tenant.updatedAt), "MMM d, yyyy HH:mm")}
        />
      </div>
    </CardContent>
  </Card>
);

TenantDetailsCard.displayName = "TenantDetailsCard";
