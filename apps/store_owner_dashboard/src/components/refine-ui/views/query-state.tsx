"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type QueryErrorStateProps = {
  message?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
};

/**
 * Renders a failed query as an explicit error (with an optional retry) instead
 * of letting the page fall through to a "not found" / "empty" state.
 */
export const QueryErrorState = ({
  message = "Could not load this record.",
  description = "Something went wrong while fetching the data.",
  onRetry,
  className,
}: QueryErrorStateProps) => (
  <div
    className={cn(
      "flex",
      "flex-col",
      "items-center",
      "justify-center",
      "gap-3",
      "py-8",
      "text-center",
      className,
    )}
  >
    <p className={cn("text-sm", "font-medium", "text-foreground")}>{message}</p>
    <p className={cn("text-sm", "text-muted-foreground")}>{description}</p>
    {onRetry ? (
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    ) : null}
  </div>
);

QueryErrorState.displayName = "QueryErrorState";
