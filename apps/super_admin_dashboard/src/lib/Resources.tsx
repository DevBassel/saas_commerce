import { ResourceProps } from "@refinedev/core";
import { BuildingIcon, LayoutDashboardIcon } from "lucide-react";

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
    name: "platform/tenants",
    list: "/tenants",
    show: "/tenants/show/:id",
    create: "/tenants/create",
    meta: {
      label: "Tenants",
      icon: <BuildingIcon />,
    },
  },
];
