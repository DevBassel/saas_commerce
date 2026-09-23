"use client";

import { UsersList } from "./list";

export const UsersAdminsList = () => (
  <UsersList roleKey="ADMIN" title="Admins" />
);

UsersAdminsList.displayName = "UsersAdminsList";
