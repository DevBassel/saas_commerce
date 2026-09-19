"use client";

import { useGetIdentity } from "@refinedev/core";
import { useTable } from "@refinedev/react-table";

import { DataTable } from "@/components/refine-ui/data-table/data-table";
import { ListView, ListViewHeader } from "@/components/refine-ui/views/list-view";
import { userColumns } from "@/components/users/user-columns";
import { canCreateUsers } from "@/constants/users";
import type { ActorIdentity, User } from "@/types/user";

export const UsersList = () => {
  const { data: identity } = useGetIdentity<ActorIdentity>();
  const canCreate = canCreateUsers(identity?.roles?.[0] ?? null);

  const table = useTable<User>({
    columns: userColumns,
    refineCoreProps: {
      resource: "users",
      syncWithLocation: true,
      sorters: {
        initial: [{ field: "createdAt", order: "desc" }],
      },
    },
  });

  return (
    <ListView>
      <ListViewHeader canCreate={canCreate} />
      <DataTable table={table} />
    </ListView>
  );
};

UsersList.displayName = "UsersList";
