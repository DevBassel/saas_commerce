import { useEffect, useMemo, useState } from "react";
import { useTable, useLink, type CrudFilter, type CrudSort } from "@refinedev/core";
import { format } from "date-fns";
import { useNavigate } from "react-router";
import {
  ArrowUpDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBytes, storagePercent } from "@/lib/utils";
import type { Tenant } from "@/types/tenant";

const columns: { field: keyof Tenant; header: string; sortable: boolean }[] = [
  { field: "name", header: "Name", sortable: true },
  { field: "slug", header: "Slug", sortable: true },
  { field: "subdomain", header: "Subdomain", sortable: true },
  { field: "status", header: "Status", sortable: true },
  { field: "storageUsedBytes", header: "Storage", sortable: false },
  { field: "ownerUserId", header: "Owner ID", sortable: false },
  { field: "createdAt", header: "Created", sortable: true },
];

export const TenantsList = () => {
  const Link = useLink();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");

  const { tableQuery, sorters, setSorters, setFilters, currentPage, setCurrentPage, pageSize, pageCount } =
    useTable<Tenant>({
      resource: "platform/tenants",
      pagination: { pageSize: 10 },
      sorters: {
        initial: [{ field: "createdAt", order: "desc" }],
      },
    });

  const data = tableQuery.data?.data ?? [];
  const total = tableQuery.data?.total ?? 0;
  const isLoading = tableQuery.isLoading;

  useEffect(() => {
    const handle = setTimeout(() => {
      const filters: CrudFilter[] = search
        ? [{ field: "name", operator: "contains", value: search }]
        : [];
      setFilters(filters, "replace");
    }, 300);
    return () => clearTimeout(handle);
  }, [search, setFilters]);

  const activeSort = useMemo(
    () => sorters[0] as CrudSort | undefined,
    [sorters]
  );

  const toggleSort = (field: string) => {
    const current = sorters.find((s) => s.field === field);
    if (!current || current.order === "desc") {
      setSorters([{ field, order: "asc" }]);
    } else {
      setSorters([{ field, order: "desc" }]);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tenants</h1>
          <p className="text-sm text-muted-foreground">
            All stores on the platform
          </p>
        </div>
        <Button onClick={() => navigate("/tenants/create")}>
          <PlusIcon className="mr-2 h-4 w-4" />
          Create Store
        </Button>
      </div>

      <div className="relative max-w-sm">
        <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead key={col.field}>
                    {col.sortable ? (
                      <button
                        type="button"
                        className="flex items-center gap-1 hover:text-foreground"
                        onClick={() => toggleSort(col.field)}
                      >
                        {col.header}
                        <ArrowUpDownIcon
                          className={
                            activeSort?.field === col.field
                              ? "h-3 w-3 text-foreground"
                              : "h-3 w-3 text-muted-foreground/50"
                          }
                        />
                      </button>
                    ) : (
                      col.header
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    {columns.map((col) => (
                      <TableCell key={col.field}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="py-8 text-center text-muted-foreground"
                  >
                    {search ? "No tenants match the search." : "No tenants yet."}
                  </TableCell>
                </TableRow>
              ) : (
                data.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell>
                      <Link
                        to={`/tenants/show/${tenant.id}`}
                        className="font-medium hover:underline"
                      >
                        {tenant.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {tenant.slug}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {tenant.subdomain ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          tenant.status === "active" ? "default" : "secondary"
                        }
                      >
                        {tenant.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="flex flex-col gap-1">
                        <span>
                          {formatBytes(tenant.storageUsedBytes)} /{" "}
                          {formatBytes(tenant.storageCapacityBytes)}
                        </span>
                        <span className="text-xs">
                          {Math.round(
                            storagePercent(
                              tenant.storageUsedBytes,
                              tenant.storageCapacityBytes
                            )
                          )}
                          %
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {tenant.ownerUserId ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(tenant.createdAt), "MMM d, yyyy HH:mm")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total} total — page {currentPage} of {Math.max(pageCount, 1)} (
          {pageSize} / page)
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            <ChevronLeftIcon className="h-4 w-4" />
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= pageCount}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            Next
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
