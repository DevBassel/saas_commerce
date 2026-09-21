"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DateCell } from "@/components/refine-ui/data-table/date-cell";
import { sortableHeader } from "@/components/refine-ui/data-table/sortable-header";
import { Badge } from "@/components/ui/badge";
import { UserRowActions } from "@/components/users/user-row-actions";
import type { User } from "@/types/user";

export const userColumns: ColumnDef<User>[] = [
  {
    accessorKey: "name",
    header: sortableHeader<User>("Name"),
    size: 200,
  },
  {
    accessorKey: "email",
    header: sortableHeader<User>("Email"),
    size: 240,
  },
  {
    id: "role",
    header: "Role",
    enableSorting: false,
    size: 160,
    cell: ({ row }) => row.original.role?.name ?? "—",
  },
  {
    accessorKey: "emailVerified",
    header: "Email verified",
    enableSorting: false,
    size: 140,
    cell: ({ getValue }) =>
      getValue() ? (
        <Badge variant="secondary">Verified</Badge>
      ) : (
        <Badge variant="outline">Unverified</Badge>
      ),
  },
  {
    accessorKey: "createdAt",
    header: sortableHeader<User>("Created"),
    size: 140,
    cell: ({ getValue }) => <DateCell value={getValue() as string | undefined} />,
  },
  {
    id: "actions",
    header: "",
    enableSorting: false,
    size: 140,
    cell: ({ row }) => <UserRowActions id={row.original.id} />,
  },
];
