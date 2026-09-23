"use client";

import { RowActions } from "@/components/refine-ui/data-table/row-actions";

export const OrderRowActions = ({ id }: { id: number }) => (
  <RowActions
    resource="orders"
    recordItemId={id}
    hideEdit
    hideDelete
    labels={{ show: "Show order" }}
  />
);

OrderRowActions.displayName = "OrderRowActions";
