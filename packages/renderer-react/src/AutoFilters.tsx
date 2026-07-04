import type { FilterPlan } from "@kiln/ui-planner";
import { type FilterState, type FilterValue, isActive } from "./filter-types.js";

export interface AutoFiltersProps {
  filters: FilterPlan[];
  values: FilterState;
  onChange: (next: FilterState) => void;
  /** Global full-text search across searchable fields. */
  q?: string;
  onQueryChange?: (q: string) => void;
}

const inputClass =
  "rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 shadow-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-sky-900/40";

const labelClass = "text-xs font-medium text-slate-500 dark:text-slate-400";

export function AutoFilters({
  filters,
  values,
  onChange,
  q,
  onQueryChange,
}: AutoFiltersProps) {
  function set(key: string, value: FilterValue) {
    onChange({ ...values, [key]: value });
  }

  function clearAll() {
    onChange({});
    onQueryChange?.("");
  }

  const anyActive =
    Object.values(values).some(isActive) || Boolean(q && q.trim());

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white/60 p-3 dark:border-slate-800 dark:bg-slate-900/40">
      {onQueryChange && (
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Search</span>
          <input
            type="search"
            value={q ?? ""}
            placeholder="Search all text…"
            onChange={(e) => onQueryChange(e.target.value)}
            className={`${inputClass} w-56`}
          />
        </label>
      )}

      {filters.map((f) => (
        <FilterControl
          key={f.key}
          plan={f}
          value={values[f.key]}
          onChange={(v) => set(f.key, v)}
        />
      ))}

      {anyActive && (
        <button
          type="button"
          onClick={clearAll}
          className="ml-auto rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline dark:text-slate-400 dark:hover:text-slate-100"
        >
          Clear all
        </button>
      )}
    </div>
  );
}

function FilterControl({
  plan,
  value,
  onChange,
}: {
  plan: FilterPlan;
  value: FilterValue | undefined;
  onChange: (v: FilterValue) => void;
}) {
  const options = plan.enumValues ?? [];

  switch (plan.type) {
    case "select":
      return (
        <Field label={plan.label}>
          <select
            value={value?.kind === "select" ? value.value : ""}
            onChange={(e) => onChange({ kind: "select", value: e.target.value })}
            className={inputClass}
          >
            <option value="">All</option>
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </Field>
      );

    case "multiSelect": {
      const selected = value?.kind === "multiSelect" ? value.values : [];
      return (
        <Field label={plan.label}>
          <div className="flex flex-wrap gap-1">
            {options.map((o) => {
              const on = selected.includes(o);
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() =>
                    onChange({
                      kind: "multiSelect",
                      values: on ? selected.filter((s) => s !== o) : [...selected, o],
                    })
                  }
                  className={
                    "rounded-full border px-2.5 py-1 text-xs " +
                    (on
                      ? "border-sky-400 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-300"
                      : "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300")
                  }
                >
                  {o}
                </button>
              );
            })}
          </div>
        </Field>
      );
    }

    case "search":
      return (
        <Field label={plan.label}>
          <input
            type="search"
            value={value?.kind === "search" ? value.value : ""}
            placeholder={`Search ${plan.label}`}
            onChange={(e) => onChange({ kind: "search", value: e.target.value })}
            className={`${inputClass} w-44`}
          />
        </Field>
      );

    case "range": {
      const cur = value?.kind === "range" ? value : { min: undefined, max: undefined };
      const num = (s: string) => (s === "" ? undefined : Number(s));
      return (
        <Field label={plan.label}>
          <div className="flex items-center gap-1">
            <input
              type="number"
              value={cur.min ?? ""}
              placeholder="min"
              onChange={(e) => onChange({ kind: "range", min: num(e.target.value), max: cur.max })}
              className={`${inputClass} w-20`}
            />
            <span className="text-slate-400">–</span>
            <input
              type="number"
              value={cur.max ?? ""}
              placeholder="max"
              onChange={(e) => onChange({ kind: "range", min: cur.min, max: num(e.target.value) })}
              className={`${inputClass} w-20`}
            />
          </div>
        </Field>
      );
    }

    case "dateRange": {
      const cur = value?.kind === "dateRange" ? value : { from: undefined, to: undefined };
      const val = (s: string) => (s === "" ? undefined : s);
      return (
        <Field label={plan.label}>
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={cur.from ?? ""}
              onChange={(e) => onChange({ kind: "dateRange", from: val(e.target.value), to: cur.to })}
              className={inputClass}
            />
            <span className="text-slate-400">–</span>
            <input
              type="date"
              value={cur.to ?? ""}
              onChange={(e) => onChange({ kind: "dateRange", from: cur.from, to: val(e.target.value) })}
              className={inputClass}
            />
          </div>
        </Field>
      );
    }

    case "toggle": {
      const cur = value?.kind === "toggle" ? value.value : null;
      return (
        <Field label={plan.label}>
          <select
            value={cur == null ? "" : String(cur)}
            onChange={(e) =>
              onChange({
                kind: "toggle",
                value: e.target.value === "" ? null : e.target.value === "true",
              })
            }
            className={inputClass}
          >
            <option value="">All</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </Field>
      );
    }

    default:
      return null;
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}
