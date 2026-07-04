import type { UIPlan } from "@kiln/ui-planner";
import type { Row, SortSpec } from "./AutoTable.js";
import { type FilterState, isActive } from "./filter-types.js";

export interface ExplorerQuery {
  filters: FilterState;
  q: string;
  sort?: SortSpec;
  page: number;
  pageSize: number;
}

function matches(plan: UIPlan, row: Row, query: ExplorerQuery): boolean {
  for (const [key, v] of Object.entries(query.filters)) {
    if (!isActive(v)) continue;
    const raw = row[key];
    switch (v.kind) {
      case "select":
        if (String(raw ?? "") !== v.value) return false;
        break;
      case "toggle":
        if (Boolean(raw) !== v.value) return false;
        break;
      case "search":
        if (!String(raw ?? "").toLowerCase().includes(v.value.toLowerCase())) return false;
        break;
      case "multiSelect": {
        const arr = Array.isArray(raw) ? raw.map(String) : [String(raw ?? "")];
        if (!v.values.some((val) => arr.includes(val))) return false;
        break;
      }
      case "range": {
        const n = Number(raw);
        if (v.min != null && !(n >= v.min)) return false;
        if (v.max != null && !(n <= v.max)) return false;
        break;
      }
      case "dateRange": {
        const t = new Date(String(raw)).getTime();
        if (v.from && !(t >= new Date(v.from).getTime())) return false;
        if (v.to && !(t <= new Date(v.to).getTime() + 86_400_000)) return false;
        break;
      }
    }
  }

  if (query.q.trim()) {
    const term = query.q.toLowerCase();
    const keys = plan.filters
      .filter((f) => f.type === "search")
      .map((f) => f.key)
      .concat(plan.detail.fields.filter((f) => f.display === "longtext").map((f) => f.key));
    const hay = [...new Set(keys)].map((k) => String(row[k] ?? "").toLowerCase());
    if (!hay.some((h) => h.includes(term))) return false;
  }

  return true;
}

/** In-memory equivalent of the SQL query layer — used by Storybook and as a
 * fallback data source. Mirrors {@link queryRecords} semantics. */
export function filterRowsInMemory(
  plan: UIPlan,
  rows: Row[],
  query: ExplorerQuery,
): { rows: Row[]; total: number } {
  let out = rows.filter((r) => matches(plan, r, query));

  if (query.sort) {
    const { key, dir } = query.sort;
    const col = plan.columns.find((c) => c.key === key);
    const numeric = col?.display === "number";
    const factor = dir === "desc" ? -1 : 1;
    out = [...out].sort((a, b) => {
      const av = a[key];
      const bv = b[key];
      if (av == null) return 1;
      if (bv == null) return -1;
      if (numeric) return (Number(av) - Number(bv)) * factor;
      return String(av).localeCompare(String(bv)) * factor;
    });
  }

  const total = out.length;
  const start = (query.page - 1) * query.pageSize;
  return { rows: out.slice(start, start + query.pageSize), total };
}
