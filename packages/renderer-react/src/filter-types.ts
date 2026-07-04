/** UI-side filter values, keyed by field. Framework-agnostic so the web app
 * can translate them into SQL query params (§8.1). */
export type FilterValue =
  | { kind: "select"; value: string }
  | { kind: "multiSelect"; values: string[] }
  | { kind: "search"; value: string }
  | { kind: "range"; min?: number; max?: number }
  | { kind: "dateRange"; from?: string; to?: string }
  | { kind: "toggle"; value: boolean | null };

export type FilterState = Record<string, FilterValue>;

/** True when a filter value would actually constrain the result set. */
export function isActive(v: FilterValue): boolean {
  switch (v.kind) {
    case "select":
    case "search":
      return v.value.trim() !== "";
    case "multiSelect":
      return v.values.length > 0;
    case "range":
      return v.min != null || v.max != null;
    case "dateRange":
      return Boolean(v.from) || Boolean(v.to);
    case "toggle":
      return v.value != null;
    default:
      return false;
  }
}
