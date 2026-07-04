import { and, count, eq, sql, type SQL } from "drizzle-orm";
import type { DbClient } from "./client.js";
import { records } from "./schema.js";

export type FilterInput =
  | { key: string; kind: "select"; value: string }
  | { key: string; kind: "multiSelect"; values: string[] }
  | { key: string; kind: "search"; value: string }
  | { key: string; kind: "range"; min?: number; max?: number }
  | { key: string; kind: "dateRange"; from?: string; to?: string }
  | { key: string; kind: "toggle"; value: boolean };

export type SortCast = "text" | "numeric" | "timestamp";

export interface QueryParams {
  filters?: FilterInput[];
  /** Global full-text search applied across `searchKeys` with OR. */
  q?: string;
  searchKeys?: string[];
  sort?: { key: string; dir: "asc" | "desc"; cast?: SortCast };
  page?: number;
  pageSize?: number;
}

export interface QueryResult {
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
}

/** `data ->> key` as text. */
function asText(key: string): SQL {
  return sql`(${records.data} ->> ${key})`;
}

function filterCondition(f: FilterInput): SQL | undefined {
  switch (f.kind) {
    case "select":
      return sql`${asText(f.key)} = ${f.value}`;
    case "toggle":
      return sql`${asText(f.key)} = ${String(f.value)}`;
    case "search":
      return f.value ? sql`${asText(f.key)} ILIKE ${`%${f.value}%`}` : undefined;
    case "multiSelect": {
      if (f.values.length === 0) return undefined;
      // Works for both scalar fields and JSON-array fields: match either the
      // extracted text OR array containment.
      const parts = f.values.map(
        (v) => sql`(${asText(f.key)} = ${v} OR ${records.data} -> ${f.key} ? ${v})`,
      );
      return sql`(${sql.join(parts, sql` OR `)})`;
    }
    case "range": {
      const conds: SQL[] = [];
      if (f.min != null) conds.push(sql`${asText(f.key)}::numeric >= ${f.min}`);
      if (f.max != null) conds.push(sql`${asText(f.key)}::numeric <= ${f.max}`);
      return conds.length ? sql`(${sql.join(conds, sql` AND `)})` : undefined;
    }
    case "dateRange": {
      const conds: SQL[] = [];
      if (f.from) conds.push(sql`${asText(f.key)}::timestamptz >= ${f.from}`);
      if (f.to) conds.push(sql`${asText(f.key)}::timestamptz <= ${f.to}`);
      return conds.length ? sql`(${sql.join(conds, sql` AND `)})` : undefined;
    }
    default:
      return undefined;
  }
}

function buildWhere(datasetId: string, params: QueryParams): SQL {
  const conds: SQL[] = [eq(records.datasetId, datasetId)];

  for (const f of params.filters ?? []) {
    const c = filterCondition(f);
    if (c) conds.push(c);
  }

  if (params.q && params.searchKeys?.length) {
    const term = `%${params.q}%`;
    const ors = params.searchKeys.map((k) => sql`${asText(k)} ILIKE ${term}`);
    conds.push(sql`(${sql.join(ors, sql` OR `)})`);
  }

  return and(...conds)!;
}

function orderBy(params: QueryParams): SQL {
  const s = params.sort;
  if (!s) return sql`${records.createdAt} ASC`;
  const cast =
    s.cast === "numeric" ? sql`::numeric` : s.cast === "timestamp" ? sql`::timestamptz` : sql``;
  const dir = s.dir === "desc" ? sql`DESC` : sql`ASC`;
  return sql`(${records.data} ->> ${s.key})${cast} ${dir} NULLS LAST`;
}

/**
 * Filter, search, sort and paginate a dataset's records entirely in Postgres
 * (§8.1) so the client stays thin.
 */
export async function queryRecords(
  db: DbClient,
  datasetId: string,
  params: QueryParams = {},
): Promise<QueryResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(500, Math.max(1, params.pageSize ?? 50));
  const where = buildWhere(datasetId, params);

  const countRows = await db.select({ n: count() }).from(records).where(where);
  const n = countRows[0]?.n ?? 0;

  const rows = await db
    .select({ data: records.data })
    .from(records)
    .where(where)
    .orderBy(orderBy(params))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    rows: rows.map((r) => r.data),
    total: n,
    page,
    pageSize,
  };
}
