import type { ColumnPlan } from "@kiln/ui-planner";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { Cell } from "./Cell.js";

export type Row = Record<string, unknown>;

export interface SortSpec {
  key: string;
  dir: "asc" | "desc";
}

export interface AutoTableProps {
  columns: ColumnPlan[];
  rows: Row[];
  /** Controlled sort. When `onSortChange` is provided, sorting is delegated to
   * the caller (server-side); otherwise the table sorts client-side. */
  sort?: SortSpec;
  onSortChange?: (sort: SortSpec | undefined) => void;
  onRowClick?: (row: Row) => void;
}

/** Auto-generated data table driven entirely by a {@link ColumnPlan}[]. */
export function AutoTable({
  columns,
  rows,
  sort,
  onSortChange,
  onRowClick,
}: AutoTableProps) {
  const manual = Boolean(onSortChange);
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);

  const sorting: SortingState = manual
    ? sort
      ? [{ id: sort.key, desc: sort.dir === "desc" }]
      : []
    : internalSorting;

  const columnDefs = useMemo<ColumnDef<Row>[]>(
    () =>
      columns.map((col) => ({
        accessorKey: col.key,
        header: col.label,
        enableSorting: col.sortable,
        cell: (ctx) => (
          <Cell value={ctx.getValue()} display={col.display} compact />
        ),
        meta: { primary: col.primary },
      })),
    [columns],
  );

  const table = useReactTable({
    data: rows,
    columns: columnDefs,
    state: { sorting },
    manualSorting: manual,
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      if (manual) {
        const first = next[0];
        onSortChange?.(first ? { key: first.id, dir: first.desc ? "desc" : "asc" } : undefined);
      } else {
        setInternalSorting(next);
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: manual ? undefined : getSortedRowModel(),
  });

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-slate-50 dark:bg-slate-900/60">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((header) => {
                const canSort = header.column.getCanSort();
                const dir = header.column.getIsSorted();
                return (
                  <th
                    key={header.id}
                    scope="col"
                    className="whitespace-nowrap border-b border-slate-200 px-3 py-2.5 text-left font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-300"
                  >
                    {canSort ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <span className="text-slate-400">
                          {dir === "asc" ? "▲" : dir === "desc" ? "▼" : "↕"}
                        </span>
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              className={
                "border-b border-slate-100 last:border-0 dark:border-slate-800/60 " +
                (onRowClick ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/40" : "")
              }
            >
              {row.getVisibleCells().map((cell) => {
                const primary = (cell.column.columnDef.meta as { primary?: boolean } | undefined)
                  ?.primary;
                return (
                  <td
                    key={cell.id}
                    className={
                      "px-3 py-2.5 align-top " +
                      (primary ? "font-medium text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-300")
                    }
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                );
              })}
            </tr>
          ))}
          {table.getRowModel().rows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="px-3 py-10 text-center text-slate-400"
              >
                No records match the current filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
