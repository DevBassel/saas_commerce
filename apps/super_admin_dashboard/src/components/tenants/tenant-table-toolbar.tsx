"use client";

import { useEffect, useState } from "react";
import type { CrudFilter, HttpError } from "@refinedev/core";
import type { UseTableReturnType } from "@refinedev/react-table";
import { SearchIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Tenant } from "@/types/tenant";

export const TenantTableToolbar = ({
  table,
}: {
  table: UseTableReturnType<Tenant, HttpError>;
}) => {
  const [search, setSearch] = useState("");
  const { setFilters } = table.refineCore;

  useEffect(() => {
    const handle = setTimeout(() => {
      const filters: CrudFilter[] = search
        ? [{ field: "name", operator: "contains", value: search }]
        : [];
      setFilters(filters, "replace");
    }, 300);
    return () => clearTimeout(handle);
  }, [search, setFilters]);

  return (
    <div className={cn("relative", "max-w-sm")}>
      <SearchIcon
        className={cn(
          "absolute",
          "left-2.5",
          "top-2.5",
          "h-4",
          "w-4",
          "text-muted-foreground",
        )}
      />
      <Input
        placeholder="Search by name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="pl-8"
      />
    </div>
  );
};

TenantTableToolbar.displayName = "TenantTableToolbar";
