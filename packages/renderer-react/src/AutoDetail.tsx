import type { DetailFieldPlan } from "@kiln/ui-planner";
import { Cell } from "./Cell.js";
import type { Row } from "./AutoTable.js";

export interface AutoDetailProps {
  fields: DetailFieldPlan[];
  record: Row;
}

/** Full record view: every field, label + value, in planned order. */
export function AutoDetail({ fields, record }: AutoDetailProps) {
  return (
    <dl className="divide-y divide-slate-100 dark:divide-slate-800">
      {fields.map((f) => (
        <div key={f.key} className="grid grid-cols-3 gap-4 py-3">
          <dt className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {f.label}
          </dt>
          <dd className="col-span-2 text-sm text-slate-800 dark:text-slate-100">
            <Cell value={record[f.key]} display={f.display} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

export interface DetailModalProps extends AutoDetailProps {
  title?: string;
  onClose: () => void;
}

/** Modal wrapper around {@link AutoDetail}. */
export function DetailModal({ fields, record, title, onClose }: DetailModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm sm:p-8"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="my-8 w-full max-w-2xl rounded-2xl bg-white shadow-xl ring-1 ring-slate-200 dark:bg-slate-950 dark:ring-slate-800"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            {title ?? "Record"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            ✕
          </button>
        </div>
        <div className="px-6 py-2">
          <AutoDetail fields={fields} record={record} />
        </div>
      </div>
    </div>
  );
}
