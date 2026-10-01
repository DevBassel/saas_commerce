import { ResourceProps } from "@refinedev/core";
import {
  BuildingIcon,
  CoinsIcon,
  CreditCardIcon,
  LayoutDashboardIcon,
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
    name: "platform/tenants",
    list: "/tenants",
    show: "/tenants/show/:id",
    create: "/tenants/create",
    meta: {
      label: "Tenants",
      icon: <BuildingIcon />,
    },
  },
  {
    name: "platform/payments",
    list: "/payments",
    show: "/payments/show/:id",
    meta: {
      label: "Payments",
      icon: <CreditCardIcon />,
    },
  },
  {
    name: "platform/currency-requests",
    list: "/currency-requests",
    meta: {
      label: "Currency Requests",
      icon: <CoinsIcon />,
    },
  },
];
