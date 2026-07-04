import { loadDataset } from "@/lib/kiln";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExplorerClient } from "./ExplorerClient";

export const dynamic = "force-dynamic";

export default async function DatasetPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ project?: string }>;
}) {
  const { name } = await params;
  const { project = "default" } = await searchParams;
  const decoded = decodeURIComponent(name);

  const data = await loadDataset(decoded, project);
  if (!data) notFound();

  const hasCharts = data.plan.charts.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/"
          className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        >
          ← All datasets
        </Link>
        <div className="mt-2 flex flex-wrap items-baseline gap-3">
          <h1 className="text-2xl font-semibold">{data.name}</h1>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {data.mode}
          </span>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {data.recordCount.toLocaleString()} {data.entity}
            {data.recordCount === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      <ExplorerClient
        name={data.name}
        project={project}
        entity={data.entity}
        plan={data.plan}
        initialRows={data.initialRows}
        initialTotal={data.initialTotal}
        showCharts={hasCharts}
      />
    </div>
  );
}
