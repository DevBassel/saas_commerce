import { useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, formatBytes, storagePercent } from "@/lib/utils";

const SIZE = 96;
const STROKE_WIDTH = 8;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export const StorageCard = ({
  usedBytes,
  capacityBytes,
  isLoading,
  isError,
}: {
  usedBytes: number;
  capacityBytes: number;
  isLoading: boolean;
  isError: boolean;
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const percent = storagePercent(usedBytes, capacityBytes);
  const strokeDashoffset = mounted
    ? CIRCUMFERENCE * (1 - percent / 100)
    : CIRCUMFERENCE;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Storage
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-24 w-24 rounded-full" />
        ) : isError ? (
          <div className="text-2xl font-bold">—</div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="relative flex items-center justify-center">
              <svg
                role="img"
                aria-label={`Storage: ${formatBytes(usedBytes)} of ${formatBytes(capacityBytes)}`}
                width={SIZE}
                height={SIZE}
                viewBox={`0 0 ${SIZE} ${SIZE}`}
                className="-rotate-90"
              >
                <circle
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  strokeWidth={STROKE_WIDTH}
                  className="stroke-muted"
                />
                <circle
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  strokeWidth={STROKE_WIDTH}
                  strokeLinecap="round"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={strokeDashoffset}
                  className={cn(
                    "transition-[stroke-dashoffset] duration-1000 ease-out",
                    percent >= 90 ? "stroke-destructive" : "stroke-primary",
                  )}
                />
              </svg>
              <span className="absolute text-xl font-bold">
                {Math.round(percent)}%
              </span>
            </div>
            <div className="text-center text-sm">
              <span className="font-bold">{formatBytes(usedBytes)}</span>{" "}
              <span className="text-muted-foreground">
                of {formatBytes(capacityBytes)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

StorageCard.displayName = "StorageCard";
