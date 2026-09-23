import { useState } from "react";
import { useShow, useLink, useNotification } from "@refinedev/core";
import { format } from "date-fns";
import { useParams } from "react-router";
import { ArrowLeftIcon, Loader2Icon } from "lucide-react";

import { tenantsApi } from "@/api/tenants.api";
import { toApiError } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBytes, storagePercent } from "@/lib/utils";
import type { Tenant } from "@/types/tenant";

const Field = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-1">
    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {label}
    </span>
    <span className="text-sm font-medium break-all">{children}</span>
  </div>
);

export const TenantsShow = () => {
  const Link = useLink();
  const { open } = useNotification();
  const { id } = useParams();
  const [toggling, setToggling] = useState(false);

  const { query } = useShow<Tenant>({
    resource: "platform/tenants",
    id,
  });

  const tenant = query.data?.data;

  const handleToggleActive = async () => {
    if (!tenant) return;
    const wasActive = tenant.status === "active";
    setToggling(true);
    try {
      await tenantsApi.toggleActive(tenant.id);
      open?.({
        type: "success",
        message: `Tenant ${wasActive ? "deactivated" : "activated"}`,
      });
      await query.refetch();
    } catch (error) {
      open?.({ type: "error", message: toApiError(error).message });
    } finally {
      setToggling(false);
    }
  };

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="flex flex-col items-center gap-4 p-4 md:p-6">
        <p className="text-muted-foreground">Tenant not found.</p>
        <Button asChild variant="outline">
          <Link to="/tenants">
            <ArrowLeftIcon className="mr-2 h-4 w-4" />
            Back to Tenants
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link to="/tenants">
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{tenant.name}</h1>
          <p className="text-sm text-muted-foreground">Tenant #{tenant.id}</p>
        </div>
        <Button
          variant={tenant.status === "active" ? "destructive" : "default"}
          className="ml-auto"
          disabled={toggling}
          onClick={handleToggleActive}
        >
          {toggling && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
          {tenant.status === "active" ? "Deactivate" : "Activate"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            Details
            <Badge
              variant={tenant.status === "active" ? "default" : "secondary"}
            >
              {tenant.status}
            </Badge>
          </CardTitle>
          <CardDescription>Platform tenant information</CardDescription>
        </CardHeader>
        <Separator />
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Name">{tenant.name}</Field>
            <Field label="Slug">{tenant.slug}</Field>
            <Field label="Schema">{tenant.schemaName}</Field>
            <Field label="Subdomain">{tenant.subdomain ?? "—"}</Field>
            <Field label="Owner User ID">{tenant.ownerUserId ?? "—"}</Field>
            <Field label="Status">{tenant.status}</Field>
            <Field label="Created">
              {format(new Date(tenant.createdAt), "MMM d, yyyy HH:mm")}
            </Field>
            <Field label="Updated">
              {format(new Date(tenant.updatedAt), "MMM d, yyyy HH:mm")}
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Owner</CardTitle>
          <CardDescription>Store owner account</CardDescription>
        </CardHeader>
        <Separator />
        <CardContent>
          {tenant.owner ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Name">{tenant.owner.name}</Field>
              <Field label="Email">{tenant.owner.email}</Field>
              <Field label="Role">
                {tenant.owner.role ? (
                  <Badge variant="outline">{tenant.owner.role.name}</Badge>
                ) : (
                  "—"
                )}
              </Field>
              <Field label="Permissions">
                {tenant.owner.permissions.length > 0 ? (
                  <span className="flex flex-wrap gap-2">
                    {tenant.owner.permissions.map((permission) => (
                      <Badge
                        key={permission.key}
                        variant="outline"
                        title={permission.key}
                      >
                        {permission.name}
                      </Badge>
                    ))}
                  </span>
                ) : (
                  "—"
                )}
              </Field>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No owner assigned.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Storage</CardTitle>
          <CardDescription>Disk usage for this tenant</CardDescription>
        </CardHeader>
        <Separator />
        <CardContent>
          <div className="flex flex-col gap-6">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Used">{formatBytes(tenant.storageUsedBytes)}</Field>
              <Field label="Used %">
                {`${Math.round(
                  storagePercent(
                    tenant.storageUsedBytes,
                    tenant.storageCapacityBytes,
                  ),
                )}%`}
              </Field>
              <Field label="Capacity">
                {formatBytes(tenant.storageCapacityBytes)}
              </Field>
            </div>
            <Progress
              value={storagePercent(
                tenant.storageUsedBytes,
                tenant.storageCapacityBytes,
              )}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
