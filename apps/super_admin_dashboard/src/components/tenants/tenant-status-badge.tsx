"use client";

import { Badge } from "@/components/ui/badge";
import { TENANT_STATUS_ACTIVE } from "@/constants/tenants";

export const TenantStatusBadge = ({ status }: { status: string }) => (
  <Badge
    variant={status === TENANT_STATUS_ACTIVE ? "default" : "secondary"}
  >
    {status}
  </Badge>
);

TenantStatusBadge.displayName = "TenantStatusBadge";
