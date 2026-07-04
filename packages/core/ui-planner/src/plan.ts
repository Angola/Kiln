import type { DatasetMode, FieldSpec, FieldType, Schema } from "@kiln/dataset-spec";
import type {
  CellDisplay,
  ChartCandidate,
  ColumnPlan,
  DetailFieldPlan,
  FilterPlan,
  UIPlan,
} from "./types.js";

export interface PlanOptions {
  mode?: DatasetMode;
  /** Cap on columns shown in the table (rest still appear in detail). */
  maxColumns?: number;
}

const DISPLAY_BY_TYPE: Record<FieldType, CellDisplay> = {
  id: "text",
  string: "text",
  text: "longtext",
  number: "number",
  boolean: "boolean",
  date: "date",
  datetime: "datetime",
  url: "link",
  image: "thumbnail",
  category: "badge",
  array: "tags",
};

const SORTABLE: Record<FieldType, boolean> = {
  id: true,
  string: true,
  text: false,
  number: true,
  boolean: true,
  date: true,
  datetime: true,
  url: false,
  image: false,
  category: true,
  array: false,
};

/** Lower number = shown further left / higher up. */
function rolePriority(spec: FieldSpec): number {
  switch (spec.role) {
    case "title":
      return 0;
    case "id":
      return 1;
    case "time":
      return 2;
    case "category":
      return 3;
    case "metric":
      return 4;
    case "tag":
      return 5;
    case "link":
      return 6;
    case "image":
      return 7;
    case "description":
      return 9;
    default:
      return 8;
  }
}

function displayFor(spec: FieldSpec): CellDisplay {
  return DISPLAY_BY_TYPE[spec.type];
}

function pickFirst(
  entries: [string, FieldSpec][],
  pred: (s: FieldSpec) => boolean,
): string | undefined {
  return entries.find(([, s]) => pred(s))?.[0];
}

function buildCharts(
  entries: [string, FieldSpec][],
  timeField: string | undefined,
  mode: DatasetMode,
): ChartCandidate[] {
  const charts: ChartCandidate[] = [];
  const metrics = entries.filter(([, s]) => s.role === "metric");
  const categories = entries.filter(([, s]) => s.type === "category");

  // Time × metric → line (especially valuable for append datasets — §4.2).
  if (timeField) {
    for (const [key, spec] of metrics) {
      charts.push({
        kind: "line",
        x: timeField,
        y: key,
        label: `${spec.label ?? key} over time`,
        reason:
          mode === "append"
            ? "append dataset with a time field and a metric — track the trend"
            : "time field and a metric present",
      });
    }
  }

  // Category × metric → bar.
  if (categories[0] && metrics[0]) {
    const [cKey, cSpec] = categories[0];
    const [mKey, mSpec] = metrics[0];
    charts.push({
      kind: "bar",
      x: cKey,
      y: mKey,
      label: `${mSpec.label ?? mKey} by ${cSpec.label ?? cKey}`,
      reason: "a category to group by and a metric to aggregate",
    });
  }

  // Category counts → pie (only when no metric to aggregate).
  if (categories[0] && metrics.length === 0) {
    const [cKey, cSpec] = categories[0];
    charts.push({
      kind: "pie",
      x: cKey,
      y: "__count__",
      label: `Distribution by ${cSpec.label ?? cKey}`,
      reason: "a category with no metric — show record distribution",
    });
  }

  return charts;
}

/**
 * Produce a {@link UIPlan} from an (already-inferred) schema. Pure function of
 * schema + options — no data required — so it is trivially testable and
 * Storybook-friendly (§8 Storybook note).
 */
export function planUI(schema: Schema, opts: PlanOptions = {}): UIPlan {
  const mode = opts.mode ?? "snapshot";
  const maxColumns = opts.maxColumns ?? 8;

  const entries = Object.entries(schema);
  const ordered = [...entries].sort(
    (a, b) => rolePriority(a[1]) - rolePriority(b[1]),
  );

  const primaryKey = pickFirst(entries, (s) => s.role === "id");
  const titleField =
    pickFirst(entries, (s) => s.role === "title") ??
    pickFirst(entries, (s) => s.type === "category");
  const timeField = pickFirst(entries, (s) => s.role === "time");

  const primaryColumnKey = titleField ?? primaryKey;

  const allColumns: ColumnPlan[] = ordered.map(([key, spec]) => ({
    key,
    label: spec.label ?? key,
    type: spec.type,
    role: spec.role,
    display: displayFor(spec),
    sortable: SORTABLE[spec.type],
    primary: key === primaryColumnKey,
  }));

  // Table columns: cap count but always keep the primary column.
  const columns: ColumnPlan[] = [];
  for (const col of allColumns) {
    if (columns.length < maxColumns || col.primary) columns.push(col);
  }

  const filters: FilterPlan[] = ordered
    .filter(([, s]) => s.filter)
    .map(([key, spec]) => ({
      key,
      label: spec.label ?? key,
      type: spec.filter!,
      ...(spec.enumValues ? { enumValues: spec.enumValues } : {}),
    }));

  const detail: DetailFieldPlan[] = ordered.map(([key, spec]) => ({
    key,
    label: spec.label ?? key,
    type: spec.type,
    display: displayFor(spec),
  }));

  const charts = buildCharts(ordered, timeField, mode);

  return {
    ...(primaryKey ? { primaryKey } : {}),
    ...(titleField ? { titleField } : {}),
    ...(timeField ? { timeField } : {}),
    columns,
    filters,
    detail: { fields: detail },
    charts,
  };
}
