import { format } from "date-fns";
import { useLink } from "@refinedev/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { TenantStatusBadge } from "@/components/tenants/tenant-status-badge";
import type { Tenant } from "@/types/tenant";

interface RecentTenantsTableProps {
  tenants: Tenant[];
  isLoading: boolean;
}

export function RecentTenantsTable({ tenants, isLoading }: RecentTenantsTableProps) {
  const Link = useLink();
  const recentTenants = tenants.slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Tenants</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : recentTenants.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No tenants yet. Create the first store.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Subdomain</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentTenants.map((tenant) => (
                <TableRow key={tenant.id}>
                  <TableCell>
                    <Link
                      to={`/tenants/show/${tenant.id}`}
                      className="font-medium hover:underline"
                    >
                      {tenant.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {tenant.slug}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {tenant.subdomain ?? "—"}
                  </TableCell>
                  <TableCell>
                    <TenantStatusBadge status={tenant.status} />
                  </TableCell>
                  <TableCell className={cn("text-muted-foreground")}>
                    {format(new Date(tenant.createdAt), "MMM d, yyyy")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}