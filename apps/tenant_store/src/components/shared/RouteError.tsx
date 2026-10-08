"use client";

import { Button } from "@/components/ui/button";
import { TriangleAlert } from "lucide-react";

interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Shared body for route-level `error.tsx` boundaries so each segment only
 * re-exports it. `reset()` re-renders the segment; the page-level inline
 * `ApiErrorFallback` still owns expected API errors.
 */
export default function RouteError({ error, reset }: RouteErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <TriangleAlert size={160} className="text-destructive/40" />
      <p className="text-2xl">Something went wrong</p>
      <p className="max-w-md text-muted-foreground">
        {error.message || "An unexpected error occurred. Please try again."}
      </p>
      <Button variant="outline" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  );
}
