import type { HttpError, BaseRecord } from "@refinedev/core";
import type { UseTableReturnType } from "@refinedev/react-table";
import type { Column } from "@tanstack/react-table";
import { flexRender } from "@tanstack/react-table";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTablePagination } from "@/components/refine-ui/data-table/data-table-pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type DataTableProps<TData extends BaseRecord> = {
  table: UseTableReturnType<TData, HttpError>;
};

export function DataTable<TData extends BaseRecord>({
  table,
}: DataTableProps<TData>) {
  const {
    reactTable: { getHeaderGroups, getRowModel, getAllColumns },
    refineCore: {
      tableQuery,
      currentPage,
      setCurrentPage,
      pageCount,
      pageSize,
      setPageSize,
    },
  } = table;

  const columns = getAllColumns();
  const leafColumns = table.reactTable.getAllLeafColumns();
  const isLoading = tableQuery.isLoading;
  const totalSize = leafColumns.reduce(
    (sum, column) => sum + column.getSize(),
    0,
  );

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [isOverflowing, setIsOverflowing] = useState({
    horizontal: false,
    vertical: false,
  });

  useLayoutEffect(() => {
    const actionsColumn = table.reactTable.getColumn("actions");
    if (!actionsColumn) return;

    table.reactTable.setColumnPinning((previous) =>
      previous.right?.includes("actions")
        ? previous
        : { ...previous, right: [...(previous.right ?? []), "actions"] },
    );
  }, [table.reactTable]);

  useEffect(() => {
    const table = tableRef.current;
    const container = tableContainerRef.current;
    if (!table || !container) return;

    const checkOverflow = () => {
      const next = {
        horizontal: table.offsetWidth > container.clientWidth,
        vertical: table.offsetHeight > container.clientHeight,
      };

      setIsOverflowing((previous) =>
        previous.horizontal === next.horizontal &&
        previous.vertical === next.vertical
          ? previous
          : next,
      );
    };

    checkOverflow();

    const observer = new ResizeObserver(checkOverflow);
    observer.observe(table);
    observer.observe(container);

    return () => observer.disconnect();
  }, [tableQuery.data?.data, pageSize]);

  return (
    <div className={cn("flex", "flex-col", "flex-1", "gap-4")}>
      <div ref={tableContainerRef} className={cn("rounded-md", "border")}>
        <Table
          ref={tableRef}
          style={{ tableLayout: "fixed", width: "100%", minWidth: totalSize }}
        >
          <TableHeader>
            {getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const isPlaceholder = header.isPlaceholder;

                  return (
                    <TableHead
                      key={header.id}
                      style={{
                        ...getCommonStyles({
                          column: header.column,
                          isOverflowing: isOverflowing,
                        }),
                      }}
                    >
                      {isPlaceholder ? null : (
                        <div className={cn("flex", "items-center", "gap-1")}>
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                        </div>
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className="relative">
            {isLoading ? (
              <>
                {Array.from({ length: pageSize < 1 ? 1 : pageSize }).map(
                  (_, rowIndex) => (
                    <TableRow
                      key={`skeleton-row-${rowIndex}`}
                      aria-hidden="true"
                    >
                      {leafColumns.map((column) => (
                        <TableCell
                          key={`skeleton-cell-${rowIndex}-${column.id}`}
                          style={{
                            ...getCommonStyles({
                              column,
                              isOverflowing: isOverflowing,
                            }),
                          }}
                          className={cn("truncate")}
                        >
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ),
                )}
              </>
            ) : getRowModel().rows?.length ? (
              getRowModel().rows.map((row) => {
                return (
                  <TableRow
                    key={row.original?.id ?? row.id}
                    data-state={row.getIsSelected() && "selected"}
                  >
                    {row.getVisibleCells().map((cell) => {
                      return (
                        <TableCell
                          key={cell.id}
                          style={{
                            ...getCommonStyles({
                              column: cell.column,
                              isOverflowing: isOverflowing,
                            }),
                          }}
                        >
                          <div className="truncate">
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })
            ) : (
              <DataTableNoData
                columnsLength={columns.length}
              />
            )}
          </TableBody>
        </Table>
      </div>
      {!isLoading && getRowModel().rows?.length > 0 && (
        <DataTablePagination
          currentPage={currentPage}
          pageCount={pageCount}
          setCurrentPage={setCurrentPage}
          pageSize={pageSize}
          setPageSize={setPageSize}
          total={tableQuery.data?.total}
        />
      )}
    </div>
  );
}

function DataTableNoData({
  columnsLength,
}: {
  columnsLength: number;
}) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell
        colSpan={columnsLength}
        className={cn("relative", "text-center")}
      >
        <div
          className={cn(
            "flex",
            "flex-col",
            "items-center",
            "justify-center",
            "gap-2",
            "h-64",
            "bg-background",
          )}
        >
          <div className={cn("text-lg", "font-semibold", "text-foreground")}>
            No data to display
          </div>
          <div className={cn("text-sm", "text-muted-foreground")}>
            This table is empty for the time being.
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}

function getCommonStyles<TData>({
  column,
  isOverflowing,
}: {
  column: Column<TData>;
  isOverflowing: {
    horizontal: boolean;
    vertical: boolean;
  };
}): React.CSSProperties {
  const isPinned = column.getIsPinned();
  const isLastLeftPinnedColumn =
    isPinned === "left" && column.getIsLastColumn("left");
  const isFirstRightPinnedColumn =
    isPinned === "right" && column.getIsFirstColumn("right");

  return {
    boxShadow:
      isOverflowing.horizontal && isLastLeftPinnedColumn
        ? "-4px 0 4px -4px var(--border) inset"
        : isOverflowing.horizontal && isFirstRightPinnedColumn
          ? "4px 0 4px -4px var(--border) inset"
          : undefined,
    left:
      isOverflowing.horizontal && isPinned === "left"
        ? `${column.getStart("left")}px`
        : undefined,
    right:
      isOverflowing.horizontal && isPinned === "right"
        ? `${column.getAfter("right")}px`
        : undefined,
    opacity: 1,
    position: isOverflowing.horizontal && isPinned ? "sticky" : "relative",
    background: isOverflowing.horizontal && isPinned ? "var(--background)" : "",
    borderTopRightRadius:
      isOverflowing.horizontal && isPinned === "right"
        ? "var(--radius)"
        : undefined,
    borderBottomRightRadius:
      isOverflowing.horizontal && isPinned === "right"
        ? "var(--radius)"
        : undefined,
    borderTopLeftRadius:
      isOverflowing.horizontal && isPinned === "left"
        ? "var(--radius)"
        : undefined,
    borderBottomLeftRadius:
      isOverflowing.horizontal && isPinned === "left"
        ? "var(--radius)"
        : undefined,
    width: column.getSize(),
    zIndex: isOverflowing.horizontal && isPinned ? 1 : 0,
  };
}

DataTable.displayName = "DataTable";
