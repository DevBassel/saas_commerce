import { useList } from "@refinedev/core";
import { format } from "date-fns";
import {
  BuildingIcon,
  CircleCheckIcon,
  ClockIcon,
  PlusIcon,
  UsersIcon,
} from "lucide-react";

import { useLink } from "@refinedev/core";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Tenant } from "@/types/tenant";

const StatCard = ({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">
        {title}
      </CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
    </CardContent>
  </Card>
);

export const Dashboard = () => {
  const Link = useLink();

  const { query, result } = useList<Tenant>({
    resource: "platform/tenants",
    pagination: { mode: "off" },
  });

  const tenants = result.data ?? [];
  const isLoading = query.isLoading;

  const activeCount = tenants.filter((t) => t.status === "active").length;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const newCount = tenants.filter(
    (t) => new Date(t.createdAt).getTime() > weekAgo
  ).length;

  const recentTenants = tenants.slice(0, 5);

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Platform overview across all tenants
          </p>
        </div>
        <Button asChild>
          <Link to="/tenants/create">
            <PlusIcon className="mr-2 h-4 w-4" />
            Create Store
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <StatCard
              title="Total Tenants"
              value={tenants.length}
              icon={BuildingIcon}
            />
            <StatCard
              title="Active Tenants"
              value={activeCount}
              icon={CircleCheckIcon}
            />
            <StatCard title="New (7 days)" value={newCount} icon={ClockIcon} />
            <StatCard
              title="Inactive"
              value={tenants.length - activeCount}
              icon={UsersIcon}
            />
          </>
        )}
      </div>

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
                      <Badge
                        variant={tenant.status === "active" ? "default" : "secondary"}
                      >
                        {tenant.status}
                      </Badge>
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
    </div>
  );
};
