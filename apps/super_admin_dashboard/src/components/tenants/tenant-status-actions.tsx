"use client";

import { useState } from "react";
import { useNotification } from "@refinedev/core";
import { Loader2Icon } from "lucide-react";

import { toApiError } from "@/api/client";
import { tenantsApi } from "@/api/tenants.api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TENANT_STATUS_ACTIVE } from "@/constants/tenants";
import type { Tenant } from "@/types/tenant";

export const TenantStatusActions = ({
  tenant,
  onToggled,
}: {
  tenant: Tenant;
  onToggled?: () => void | Promise<void>;
}) => {
  const { open } = useNotification();
  const [toggling, setToggling] = useState(false);

  const isActive = tenant.status === TENANT_STATUS_ACTIVE;

  const handleToggleActive = async () => {
    setToggling(true);
    try {
      await tenantsApi.toggleActive(tenant.id);
      open?.({
        type: "success",
        message: `Tenant ${isActive ? "deactivated" : "activated"}`,
      });
      await onToggled?.();
    } catch (error) {
      open?.({ type: "error", message: toApiError(error).message });
    } finally {
      setToggling(false);
    }
  };

  return (
    <Button
      variant={isActive ? "destructive" : "default"}
      className={cn("ml-auto")}
      disabled={toggling}
      onClick={handleToggleActive}
    >
      {toggling && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
      {isActive ? "Deactivate" : "Activate"}
    </Button>
  );
};

TenantStatusActions.displayName = "TenantStatusActions";
