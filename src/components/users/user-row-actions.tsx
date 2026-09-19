"use client";

import { useGetIdentity } from "@refinedev/core";

import { RowActions } from "@/components/refine-ui/data-table/row-actions";
import type { ActorIdentity } from "@/types/user";

export const UserRowActions = ({ id }: { id: number }) => {
  const { data: identity } = useGetIdentity<ActorIdentity>();
  const isSelf = identity?.id != null && identity.id === id;

  return (
    <RowActions
      resource="users"
      recordItemId={id}
      hideDelete={isSelf}
      labels={{
        show: "Show user",
        edit: "Edit user",
        delete: "Delete user",
      }}
    />
  );
};

UserRowActions.displayName = "UserRowActions";
