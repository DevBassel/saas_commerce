import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type RouteFallbackProps = {
  fullScreen?: boolean;
};

export function RouteFallback({ fullScreen = false }: RouteFallbackProps) {
  return (
    <div
      role="status"
      aria-label="Loading page"
      className={cn(
        "flex w-full items-center justify-center",
        fullScreen ? "min-h-svh" : "min-h-[60vh]"
      )}
    >
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

RouteFallback.displayName = "RouteFallback";
