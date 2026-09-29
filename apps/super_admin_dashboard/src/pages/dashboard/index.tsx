import { useCustom, useList } from "@refinedev/core";
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
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
import { DetailRow } from "@/components/refine-ui/views/detail-row";
import {
  BalanceValue,
  StatusRow,
} from "@/components/payments/stripe-display";
import { TenantStatusBadge } from "@/components/tenants/tenant-status-badge";
import type { Tenant } from "@/types/tenant";
import type { PlatformStripeSummary } from "@/types/payments";

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

  const { query: stripeQuery } = useCustom<PlatformStripeSummary>({
    url: "platform/payments/summary",
    method: "get",
  });

  const tenants = result.data ?? [];
  const isLoading = query.isLoading;

  const stripeSummary = stripeQuery.data?.data;
  const stripeAccount = stripeSummary?.account ?? null;
  const stripeBalance = stripeSummary?.balance ?? null;
  const stripeUnavailableMessage =
    stripeSummary?.error ?? "Stripe is unavailable";

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

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              Platform Stripe status
              {stripeQuery.isLoading ? (
                <Skeleton className="h-5 w-24" />
              ) : (
                <Badge variant={stripeAccount ? "default" : "secondary"}>
                  {stripeAccount ? "Connected" : "Unavailable"}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Capability status of the platform's own Stripe account.
            </CardDescription>
          </CardHeader>
          <Separator />
          <CardContent>
            {stripeQuery.isLoading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : stripeAccount ? (
              <div className="flex flex-col">
                <StatusRow label="Charges" enabled={stripeAccount.chargesEnabled} />
                <Separator />
                <StatusRow label="Payouts" enabled={stripeAccount.payoutsEnabled} />
                <Separator />
                <StatusRow
                  label="Details submitted"
                  enabled={stripeAccount.detailsSubmitted}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {stripeUnavailableMessage}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Platform balance</CardTitle>
            <CardDescription>
              Available and pending balances on the platform account.
            </CardDescription>
          </CardHeader>
          <Separator />
          <CardContent>
            {stripeQuery.isLoading ? (
              <div className="grid gap-6 sm:grid-cols-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : stripeBalance ? (
              <div className="grid gap-6 sm:grid-cols-2">
                <DetailRow
                  label="Available"
                  value={<BalanceValue entries={stripeBalance.available} />}
                />
                <DetailRow
                  label="Pending"
                  value={<BalanceValue entries={stripeBalance.pending} />}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Balance is unavailable.
              </p>
            )}
          </CardContent>
        </Card>
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
    </div>
  );
};
