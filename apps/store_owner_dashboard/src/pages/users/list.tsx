"use client";

import { useGetIdentity } from "@refinedev/core";
import { useTable } from "@refinedev/react-table";

import { DataTable } from "@/components/refine-ui/data-table/data-table";
import { ListView, ListViewHeader } from "@/components/refine-ui/views/list-view";
import { userColumns } from "@/components/users/user-columns";
import { canCreateUsers } from "@/constants/users";
import type { ActorIdentity, User } from "@/types/user";

type UsersListProps = { roleKey?: string; title?: string };

export const UsersList = ({ roleKey, title }: UsersListProps = {}) => {
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
      filters: roleKey
        ? {
            permanent: [
              { field: "role.key", operator: "in", value: [roleKey] },
            ],
          }
        : undefined,
    },
  });

  return (
    <ListView>
      <ListViewHeader resource="users" title={title} canCreate={canCreate} />
      <DataTable table={table} />
    </ListView>
  );
};

UsersList.displayName = "UsersList";
