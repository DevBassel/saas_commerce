"use client";

import { Badge } from "@/components/ui/badge";
import { cn, formatMinorUnits } from "@/lib/utils";
import type { BalanceEntry } from "@/types/payments";

export const StatusRow = ({
  label,
  enabled,
}: {
  label: string;
  enabled: boolean;
}) => (
  <div className={cn("flex", "items-center", "justify-between", "py-2")}>
    <span className="text-sm text-muted-foreground">{label}</span>
    <Badge variant={enabled ? "default" : "secondary"}>
      {enabled ? "Enabled" : "Pending"}
    </Badge>
  </div>
);

export const BalanceValue = ({ entries }: { entries: BalanceEntry[] }) => {
  if (entries.length === 0) return <span>—</span>;
  return (
    <span className={cn("flex", "flex-col", "gap-1")}>
      {entries.map((entry) => (
        <span key={entry.currency}>
          {formatMinorUnits(entry.amount, entry.currency)}
        </span>
      ))}
    </span>
  );
};

StatusRow.displayName = "StatusRow";
BalanceValue.displayName = "BalanceValue";
