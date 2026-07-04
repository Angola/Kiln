import type { UIPlan } from "@kiln/ui-planner";
import { useCallback, useEffect, useRef, useState } from "react";
import { AutoChart } from "./AutoChart.js";
import { AutoFilters } from "./AutoFilters.js";
import { type Row, type SortSpec, AutoTable } from "./AutoTable.js";
import { DetailModal } from "./AutoDetail.js";
import type { ExplorerQuery } from "./client-filter.js";
import { filterRowsInMemory } from "./client-filter.js";
import type { FilterState } from "./filter-types.js";

export interface FetchResult {
  rows: Row[];
  total: number;
}

export interface DatasetExplorerProps {
  plan: UIPlan;
  entity: string;
  /** Rows rendered before the first query resolves (SSR / initial paint). */
  initialRows: Row[];
  initialTotal: number;
  pageSize?: number;
  /** Data source. Omit to filter `initialRows` entirely in-memory. */
  fetchPage?: (query: ExplorerQuery) => Promise<FetchResult>;
  showCharts?: boolean;
}

/**
 * The full Phase-1 admin view: filter bar + optional charts + sortable,
 * paginated table + detail modal. Data fetching is injected so the same
 * component serves Storybook (in-memory) and the web app (SQL-side, §8.1).
 */
export function DatasetExplorer({
  plan,
  entity,
  initialRows,
  initialTotal,
  pageSize = 25,
  fetchPage,
  showCharts = false,
}: DatasetExplorerProps) {
  const allRows = useRef(initialRows);
  const [filters, setFilters] = useState<FilterState>({});
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortSpec | undefined>(
    plan.timeField ? { key: plan.timeField, dir: "desc" } : undefined,
  );
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [total, setTotal] = useState(initialTotal);
  const [selected, setSelected] = useState<Row | null>(null);
  const [loading, setLoading] = useState(false);

  const source = useCallback(
    async (query: ExplorerQuery): Promise<FetchResult> => {
      if (fetchPage) return fetchPage(query);
      return filterRowsInMemory(plan, allRows.current, query);
    },
    [fetchPage, plan],
  );

  useEffect(() => {
    let cancelled = false;
    const query: ExplorerQuery = { filters, q, sort, page, pageSize };
    setLoading(true);
    const handle = setTimeout(() => {
      source(query)
        .then((res) => {
          if (cancelled) return;
          setRows(res.rows);
          setTotal(res.total);
        })
        .finally(() => !cancelled && setLoading(false));
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [filters, q, sort, page, pageSize, source]);

  // Reset to page 1 whenever the query (not the page) changes.
  useEffect(() => setPage(1), [filters, q, sort]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const charts = showCharts ? plan.charts.slice(0, 2) : [];

  return (
    <div className="flex flex-col gap-4">
      <AutoFilters
        filters={plan.filters}
        values={filters}
        onChange={setFilters}
        q={q}
        onQueryChange={setQ}
      />

      {charts.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {charts.map((c, i) => (
            <AutoChart key={i} candidate={c} rows={rows} />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
        <span>
          {total.toLocaleString()} {entity}
          {total === 1 ? "" : "s"}
          {loading && <span className="ml-2 animate-pulse">…</span>}
        </span>
      </div>

      <AutoTable
        columns={plan.columns}
        rows={rows}
        sort={sort}
        onSortChange={setSort}
        onRowClick={setSelected}
      />

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <PagerButton disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            ← Prev
          </PagerButton>
          <span className="text-slate-500 dark:text-slate-400">
            Page {page} of {pageCount}
          </span>
          <PagerButton disabled={page >= pageCount} onClick={() => setPage((p) => p + 1)}>
            Next →
          </PagerButton>
        </div>
      )}

      {selected && (
        <DetailModal
          fields={plan.detail.fields}
          record={selected}
          title={
            plan.titleField
              ? String(selected[plan.titleField] ?? entity)
              : entity
          }
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function PagerButton({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-600 enabled:hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:enabled:hover:bg-slate-900"
    >
      {children}
    </button>
  );
}
