import { useLink } from "@refinedev/core";
import { PlusIcon, ServerIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircleIcon, CheckCircleIcon, RefreshCwIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DatabaseIcon, HardDriveIcon } from "lucide-react";
import { healthApi, type HealthResponse } from "@/api/health.api";
import { useState } from "react";

export function DashboardHeader() {
  const Link = useLink();
  const [healthData, setHealthData] = useState<HealthResponse | null>(null);
  const [isHealthLoading, setIsHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);

  const fetchHealth = async () => {
    setIsHealthLoading(true);
    setHealthError(null);
    try {
      const data = await healthApi.getHealth();
      setHealthData(data);
    } catch (error) {
      setHealthError(
        error instanceof Error ? error.message : "Failed to fetch health"
      );
    } finally {
      setIsHealthLoading(false);
    }
  };

  const StatusIcon = ({ ok }: { ok: boolean }) => (
    ok ? (
      <CheckCircleIcon className="h-5 w-5 text-green-500" />
    ) : (
      <AlertCircleIcon className="h-5 w-5 text-red-500" />
    )
  );

  const HealthRow = ({
    label,
    icon: Icon,
    ok,
  }: {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    ok: boolean;
  }) => (
    <div className="flex items-center gap-3">
      <Icon className="h-5 w-5 text-muted-foreground" />
      <span className="flex-1">{label}</span>
      <StatusIcon ok={ok} />
    </div>
  );

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Platform overview across all tenants
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchHealth}
              disabled={isHealthLoading}
            >
              <ServerIcon className="mr-2 h-4 w-4" />
              {isHealthLoading ? "Checking..." : "Check Server"}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Platform Health</DialogTitle>
              <DialogDescription>
                Current status of platform infrastructure services.
              </DialogDescription>
            </DialogHeader>
            <Separator />
            {isHealthLoading ? (
              <div className="flex flex-col gap-3 py-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-5" />
                  <Skeleton className="flex-1 h-5 w-1/4" />
                  <Skeleton className="h-5 w-5" />
                </div>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-5" />
                  <Skeleton className="flex-1 h-5 w-1/4" />
                  <Skeleton className="h-5 w-5" />
                </div>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-5" />
                  <Skeleton className="flex-1 h-5 w-1/4" />
                  <Skeleton className="h-5 w-5" />
                </div>
              </div>
            ) : healthError ? (
              <div className="flex flex-col gap-3 py-4 text-center">
                <AlertCircleIcon className="h-10 w-10 text-red-500 mx-auto" />
                <p className="text-sm text-red-500">{healthError}</p>
                <Button variant="outline" size="sm" onClick={fetchHealth}>
                  <RefreshCwIcon className="mr-2 h-4 w-4" />
                  Retry
                </Button>
              </div>
            ) : healthData ? (
              <div className="flex flex-col gap-3 py-2">
                <div className="flex items-center gap-3">
                  <span className="flex-1 font-medium">Overall Status</span>
                  <Badge
                    variant={healthData.status === "ok" ? "default" : "destructive"}
                  >
                    {healthData.status === "ok" ? "OK" : "Degraded"}
                  </Badge>
                </div>
                <Separator />
                <HealthRow
                  label="Database"
                  icon={DatabaseIcon}
                  ok={healthData.db}
                />
                <HealthRow
                  label="R2 Storage"
                  icon={HardDriveIcon}
                  ok={healthData.r2}
                />
                <HealthRow
                  label="Cache (Redis)"
                  icon={ServerIcon}
                  ok={healthData.cache.enabled && healthData.cache.connected}
                />
                {healthData.cache.enabled && (
                  <div className="flex items-center gap-3 text-sm text-muted-foreground pl-10">
                    <span>Driver: {healthData.cache.driver}</span>
                    <span className="text-xs text-muted-foreground/70">
                      {healthData.cache.connected ? "Connected" : "Disconnected"}
                    </span>
                  </div>
                )}
                <DialogFooter>
                  <Button variant="outline" size="sm" onClick={fetchHealth}>
                    <RefreshCwIcon className="mr-2 h-4 w-4" />
                    Refresh
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="flex flex-col gap-3 py-4 text-center text-muted-foreground">
                <p>Click "Check Server" to fetch health status</p>
                <Button variant="outline" size="sm" onClick={fetchHealth}>
                  <ServerIcon className="mr-2 h-4 w-4" />
                  Check Server
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
        <Button asChild>
          <Link to="/tenants/create">
            <PlusIcon className="mr-2 h-4 w-4" />
            Create Store
          </Link>
        </Button>
      </div>
    </div>
  );
}