import type { FieldRole, FieldType, FilterType } from "@kiln/dataset-spec";

/** How a cell should be rendered. Derived from the field's semantic type. */
export type CellDisplay =
  | "text"
  | "longtext"
  | "link"
  | "thumbnail"
  | "badge"
  | "tags"
  | "datetime"
  | "date"
  | "number"
  | "boolean";

export interface ColumnPlan {
  key: string;
  label: string;
  type: FieldType;
  role?: FieldRole;
  display: CellDisplay;
  sortable: boolean;
  /** Whether this column is the row's primary/title column. */
  primary: boolean;
}

export interface FilterPlan {
  key: string;
  label: string;
  type: FilterType;
  enumValues?: string[];
}

export interface DetailFieldPlan {
  key: string;
  label: string;
  type: FieldType;
  display: CellDisplay;
}

export type ChartKind = "line" | "bar" | "pie";

export interface ChartCandidate {
  kind: ChartKind;
  /** Field used for the x-axis / category axis. */
  x: string;
  /** Field used for the y-axis / value. `__count__` means row count. */
  y: string;
  label: string;
  reason: string;
}

export interface UIPlan {
  primaryKey?: string;
  titleField?: string;
  timeField?: string;
  columns: ColumnPlan[];
  filters: FilterPlan[];
  detail: { fields: DetailFieldPlan[] };
  charts: ChartCandidate[];
}
