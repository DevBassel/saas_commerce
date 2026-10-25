import { BuildingIcon, CircleCheckIcon, ClockIcon, UsersIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Tenant } from "@/types/tenant";

interface DashboardStatsProps {
  tenants: Tenant[];
  isLoading: boolean;
}

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

export function DashboardStats({ tenants, isLoading }: DashboardStatsProps) {
  const activeCount = tenants.filter((t) => t.status === "active").length;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const newCount = tenants.filter(
    (t) => new Date(t.createdAt).getTime() > weekAgo
  ).length;

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard title="Total Tenants" value={tenants.length} icon={BuildingIcon} />
      <StatCard title="Active Tenants" value={activeCount} icon={CircleCheckIcon} />
      <StatCard title="New (7 days)" value={newCount} icon={ClockIcon} />
      <StatCard
        title="Inactive"
        value={tenants.length - activeCount}
        icon={UsersIcon}
      />
    </div>
  );
}