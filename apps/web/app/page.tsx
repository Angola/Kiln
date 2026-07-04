import { loadDatasetList } from "@/lib/kiln";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let datasets: Awaited<ReturnType<typeof loadDatasetList>> = [];
  let error: string | null = null;
  try {
    datasets = await loadDatasetList();
  } catch (e) {
    error = (e as Error).message;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Datasets</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Everything pushed through the Kiln MCP server. Open one to explore its
          auto-generated admin UI.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Couldn’t reach the database: {error}
        </div>
      )}

      {!error && datasets.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
          No datasets yet. Push one with the <code>push_dataset</code> MCP tool.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {datasets.map((d) => (
          <Link
            key={d.id}
            href={`/d/${encodeURIComponent(d.name)}`}
            className="group rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900/40 dark:hover:border-slate-700"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-medium group-hover:text-sky-600 dark:group-hover:text-sky-400">
                {d.name}
              </h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {d.mode}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {d.recordCount.toLocaleString()} {d.entity}
              {d.recordCount === 1 ? "" : "s"}
            </p>
            <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
              updated {new Date(d.updatedAt).toLocaleString()}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
