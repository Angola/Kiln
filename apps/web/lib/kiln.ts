import "server-only";
import type { Schema } from "@kiln/dataset-spec";
import {
  type FilterInput,
  type QueryParams,
  type SortCast,
  getDatasetByName,
  getDb,
  listDatasets,
  queryRecords,
} from "@kiln/db";
import { type PlanOptions, type UIPlan, planUI } from "@kiln/ui-planner";
import type { DatasetMode } from "@kiln/dataset-spec";

/** ExplorerQuery shape sent by the client (kept local to avoid importing the
 * client renderer package into server code). */
export interface ExplorerQuery {
  filters: Record<string, unknown>;
  q: string;
  sort?: { key: string; dir: "asc" | "desc" };
  page: number;
  pageSize: number;
}

function castFor(schema: Schema, key: string): SortCast {
  const t = schema[key]?.type;
  if (t === "number") return "numeric";
  if (t === "date" || t === "datetime") return "timestamp";
  return "text";
}

/** Translate a client ExplorerQuery + schema into SQL-side query params (§8.1). */
export function toQueryParams(schema: Schema, query: ExplorerQuery): QueryParams {
  const filters: FilterInput[] = [];
  for (const [key, raw] of Object.entries(query.filters ?? {})) {
    const v = raw as { kind?: string } & Record<string, unknown>;
    switch (v?.kind) {
      case "select":
        if (v.value) filters.push({ key, kind: "select", value: String(v.value) });
        break;
      case "toggle":
        if (v.value != null) filters.push({ key, kind: "toggle", value: Boolean(v.value) });
        break;
      case "search":
        if (v.value) filters.push({ key, kind: "search", value: String(v.value) });
        break;
      case "multiSelect":
        if (Array.isArray(v.values) && v.values.length)
          filters.push({ key, kind: "multiSelect", values: v.values.map(String) });
        break;
      case "range":
        if (v.min != null || v.max != null)
          filters.push({
            key,
            kind: "range",
            min: v.min != null ? Number(v.min) : undefined,
            max: v.max != null ? Number(v.max) : undefined,
          });
        break;
      case "dateRange":
        if (v.from || v.to)
          filters.push({
            key,
            kind: "dateRange",
            from: v.from ? String(v.from) : undefined,
            to: v.to ? String(v.to) : undefined,
          });
        break;
    }
  }

  const searchKeys = Object.entries(schema)
    .filter(([, s]) => s.filter === "search" || s.type === "text")
    .map(([k]) => k);

  return {
    filters,
    q: query.q,
    searchKeys,
    sort: query.sort
      ? { key: query.sort.key, dir: query.sort.dir, cast: castFor(schema, query.sort.key) }
      : undefined,
    page: query.page,
    pageSize: query.pageSize,
  };
}

export async function loadDatasetList(project = "default") {
  return listDatasets(getDb(), project);
}

export interface LoadedDataset {
  name: string;
  entity: string;
  mode: DatasetMode;
  schema: Schema;
  plan: UIPlan;
  recordCount: number;
  initialRows: Record<string, unknown>[];
  initialTotal: number;
}

export async function loadDataset(
  name: string,
  project = "default",
  pageSize = 25,
): Promise<LoadedDataset | null> {
  const db = getDb();
  const row = await getDatasetByName(db, name, project);
  if (!row) return null;

  const mode = row.mode as DatasetMode;
  const planOpts: PlanOptions = { mode };
  const plan = planUI(row.schema, planOpts);

  const initialSort = plan.timeField
    ? { key: plan.timeField, dir: "desc" as const }
    : undefined;

  const first = await queryRecords(db, row.id, {
    page: 1,
    pageSize,
    sort: initialSort
      ? { ...initialSort, cast: castFor(row.schema, initialSort.key) }
      : undefined,
  });

  return {
    name: row.name,
    entity: row.entity,
    mode,
    schema: row.schema,
    plan,
    recordCount: row.recordCount,
    initialRows: first.rows,
    initialTotal: first.total,
  };
}

export async function runQuery(name: string, project: string, query: ExplorerQuery) {
  const db = getDb();
  const row = await getDatasetByName(db, name, project);
  if (!row) return null;
  const params = toQueryParams(row.schema, query);
  const res = await queryRecords(db, row.id, params);
  return { rows: res.rows, total: res.total };
}
