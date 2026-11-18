"use client";

import { cn } from "@/lib/utils";

export const DetailRow = ({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) => (
  <div className={cn("flex", "flex-col", "gap-1", "py-2")}>
    <span className={cn("text-xs", "uppercase", "text-muted-foreground")}>
      {label}
    </span>
    <span className="min-w-0 text-sm font-medium [overflow-wrap:anywhere]">
      {value}
    </span>
  </div>
);

DetailRow.displayName = "DetailRow";
