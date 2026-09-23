import { ResourceProps } from "@refinedev/core";
import {
  LayoutDashboardIcon,
  PackageIcon,
  TagsIcon,
  UsersIcon,
  ShieldIcon,
  UserIcon,
  ClipboardListIcon,
} from "lucide-react";

export const Resources: ResourceProps[] = [
  {
    name: "dashboard",
    list: "/",
    meta: {
      label: "Dashboard",
      icon: <LayoutDashboardIcon />,
    },
  },
  {
    name: "user-management",
    meta: {
      label: "Users",
      icon: <UsersIcon />,
    },
  },

  {
    name: "users",
    list: "/users",
    create: "/users/create",
    show: "/users/show/:id",
    edit: "/users/edit/:id",
    meta: {
      label: "All Users",
      icon: <UsersIcon />,
      parent: "user-management",
    },
  },
  {
    name: "admins",
    list: "/users/admins",
    meta: {
      label: "Admins",
      icon: <ShieldIcon />,
      parent: "user-management",
    },
  },
  {
    name: "customers",
    list: "/users/customers",
    meta: {
      label: "Customers",
      icon: <UserIcon />,
      parent: "user-management",
    },
  },
  {
    name: "Products",
    meta: {
      label: "Products",
      icon: <PackageIcon />,
    },
  },
  {
    name: "products",
    list: "/products",
    create: "/products/create",
    edit: "/products/edit/:id",
    show: "/products/show/:id",
    meta: {
      label: "All Products",
      icon: <PackageIcon />,
      parent: "Products",
    },
  },
  {
    name: "categories",
    list: "/categories",
    create: "/categories/create",
    edit: "/categories/edit/:id",
    show: "/categories/show/:id",
    meta: {
      label: "Categories",
      icon: <TagsIcon />,
      parent: "Products",
    },
  },
  {
    name: "orders",
    list: "/orders",
    show: "/orders/show/:id",
    meta: {
      label: "Orders",
      icon: <ClipboardListIcon />,
      parent: "Products",
    },
  },
];
