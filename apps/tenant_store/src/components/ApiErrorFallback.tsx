"use client";

import { Button } from "@/components/ui/button";
import { TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

interface ApiErrorFallbackProps {
  title: string;
  message?: string;
  compact?: boolean;
}

export default function ApiErrorFallback({
  title,
  message,
  compact = false,
}: ApiErrorFallbackProps) {
  const router = useRouter();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    toast.error(message ?? title);
  }, [message, title]);

  if (compact) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-4 text-center text-muted-foreground">
        <TriangleAlert className="size-8 text-destructive" />
        <p className="text-sm">{title}</p>
        {message ? (
          <p className="line-clamp-2 text-xs text-muted-foreground/80">
            {message}
          </p>
        ) : null}
        <Button variant="outline" size="sm" onClick={() => router.refresh()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <TriangleAlert size={200} className="text-destructive/40" />
      <p className="text-2xl">{title}</p>
      {message ? (
        <p className="max-w-md text-muted-foreground">{message}</p>
      ) : null}
      <Button variant="outline" onClick={() => router.refresh()}>
        Try again
      </Button>
    </div>
  );
}
