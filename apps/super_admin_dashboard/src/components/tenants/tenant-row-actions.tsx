"use client";

import { RowActions } from "@/components/refine-ui/data-table/row-actions";

export const TenantRowActions = ({ id }: { id: number }) => (
  <RowActions
    resource="platform/tenants"
    recordItemId={id}
    hideEdit
    hideDelete
    labels={{ show: "Show tenant" }}
  />
);

TenantRowActions.displayName = "TenantRowActions";
