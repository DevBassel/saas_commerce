"use client";

import { DetailRow } from "@/components/refine-ui/views/detail-row";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Tenant } from "@/types/tenant";

export const TenantOwnerCard = ({ tenant }: { tenant: Tenant }) => (
  <Card>
    <CardHeader>
      <CardTitle>Owner</CardTitle>
      <CardDescription>Store owner account</CardDescription>
    </CardHeader>
    <Separator />
    <CardContent>
      {tenant.owner ? (
        <div
          className={cn("grid", "gap-6", "sm:grid-cols-2", "lg:grid-cols-3")}
        >
          <DetailRow label="Name" value={tenant.owner.name} />
          <DetailRow label="Email" value={tenant.owner.email} />
          <DetailRow
            label="Role"
            value={
              tenant.owner.role ? (
                <Badge variant="outline">{tenant.owner.role.name}</Badge>
              ) : (
                "—"
              )
            }
          />
          <DetailRow
            label="Permissions"
            value={
              tenant.owner.permissions.length > 0 ? (
                <span className={cn("flex", "flex-wrap", "gap-2")}>
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
              )
            }
          />
        </div>
      ) : (
        <p className={cn("text-sm", "text-muted-foreground")}>
          No owner assigned.
        </p>
      )}
    </CardContent>
  </Card>
);

TenantOwnerCard.displayName = "TenantOwnerCard";
