import type { CellDisplay } from "@kiln/ui-planner";
import { formatDate, formatDateTime, formatNumber, toArray, truncate } from "./format.js";

export interface CellProps {
  value: unknown;
  display: CellDisplay;
  /** In `compact` mode (table), long text is truncated and images are small. */
  compact?: boolean;
}

const badgeClass =
  "inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200";

/** Renders a single value according to its planned {@link CellDisplay}. */
export function Cell({ value, display, compact = false }: CellProps) {
  if (value == null || value === "") {
    return <span className="text-slate-300 dark:text-slate-600">—</span>;
  }

  switch (display) {
    case "link": {
      const href = String(value);
      return (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-sky-600 underline decoration-sky-300 underline-offset-2 hover:text-sky-500 dark:text-sky-400"
        >
          {truncate(href.replace(/^https?:\/\//, ""), compact ? 32 : 80)}
        </a>
      );
    }
    case "thumbnail": {
      const src = String(value);
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className={
            compact
              ? "h-9 w-9 rounded object-cover ring-1 ring-slate-200 dark:ring-slate-700"
              : "max-h-48 rounded-lg object-contain ring-1 ring-slate-200 dark:ring-slate-700"
          }
        />
      );
    }
    case "badge":
      return <span className={badgeClass}>{String(value)}</span>;
    case "tags":
      return (
        <span className="flex flex-wrap gap-1">
          {toArray(value).map((t, i) => (
            <span key={`${t}-${i}`} className={badgeClass}>
              {t}
            </span>
          ))}
        </span>
      );
    case "datetime":
      return <span className="tabular-nums">{formatDateTime(value)}</span>;
    case "date":
      return <span className="tabular-nums">{formatDate(value)}</span>;
    case "number":
      return <span className="tabular-nums">{formatNumber(value)}</span>;
    case "boolean":
      return value ? (
        <span className="text-emerald-600 dark:text-emerald-400">✓</span>
      ) : (
        <span className="text-slate-400">✗</span>
      );
    case "longtext": {
      const s = String(value);
      return compact ? (
        <span title={s} className="text-slate-600 dark:text-slate-300">
          {truncate(s, 80)}
        </span>
      ) : (
        <p className="whitespace-pre-wrap leading-relaxed text-slate-700 dark:text-slate-200">
          {s}
        </p>
      );
    }
    default:
      return <span>{String(value)}</span>;
  }
}
