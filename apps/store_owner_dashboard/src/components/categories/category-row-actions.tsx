"use client";

import { useGetIdentity } from "@refinedev/core";

import { RowActions } from "@/components/refine-ui/data-table/row-actions";
import { canManageCatalog } from "@/constants/users";
import type { ActorIdentity } from "@/types/user";

export const CategoryRowActions = ({ id }: { id: number }) => {
  const { data: identity } = useGetIdentity<ActorIdentity>();
  const canManage = canManageCatalog(identity?.roles?.[0] ?? null);

  return (
    <RowActions
      resource="categories"
      recordItemId={id}
      hideEdit={!canManage}
      hideDelete={!canManage}
      labels={{
        show: "Show category",
        edit: "Edit category",
        delete: "Delete category",
      }}
    />
  );
};

CategoryRowActions.displayName = "CategoryRowActions";
