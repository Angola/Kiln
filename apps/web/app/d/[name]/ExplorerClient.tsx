"use client";

import type { UIPlan } from "@kiln/ui-planner";
import {
  DatasetExplorer,
  type ExplorerQuery,
  type FetchResult,
  type Row,
} from "@kiln/renderer-react";
import { useCallback } from "react";

export interface ExplorerClientProps {
  name: string;
  project: string;
  entity: string;
  plan: UIPlan;
  initialRows: Row[];
  initialTotal: number;
  showCharts: boolean;
}

/** Client island: wires DatasetExplorer's data source to the SQL-side query
 * API (§8.1) so filtering/sorting/paging happen in Postgres, not the browser. */
export function ExplorerClient({
  name,
  project,
  entity,
  plan,
  initialRows,
  initialTotal,
  showCharts,
}: ExplorerClientProps) {
  const fetchPage = useCallback(
    async (query: ExplorerQuery): Promise<FetchResult> => {
      const res = await fetch(
        `/api/datasets/${encodeURIComponent(name)}/records?project=${encodeURIComponent(project)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query }),
        },
      );
      if (!res.ok) throw new Error(`query failed: ${res.status}`);
      return (await res.json()) as FetchResult;
    },
    [name, project],
  );

  return (
    <DatasetExplorer
      plan={plan}
      entity={entity}
      initialRows={initialRows}
      initialTotal={initialTotal}
      fetchPage={fetchPage}
      showCharts={showCharts}
    />
  );
}
