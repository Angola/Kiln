import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { validateDatasetSpec } from "@kiln/validator";
import {
  appendRecords,
  getDatasetById,
  getDatasetByName,
  getDb,
  listDatasets,
  pushDataset,
} from "@kiln/db";
import { z } from "zod";

const WEB_BASE = process.env.KILN_WEB_URL ?? "http://localhost:3000";

function datasetUrl(name: string, project: string): string {
  const path = `/d/${encodeURIComponent(name)}`;
  return project === "default"
    ? `${WEB_BASE}${path}`
    : `${WEB_BASE}${path}?project=${encodeURIComponent(project)}`;
}

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function fail(message: string, extra?: unknown) {
  const body = extra === undefined ? { error: message } : { error: message, details: extra };
  return {
    isError: true,
    content: [{ type: "text" as const, text: JSON.stringify(body, null, 2) }],
  };
}

const server = new McpServer({
  name: "kiln-mcp",
  version: "0.1.0",
});

const specArg = z
  .record(z.string(), z.unknown())
  .describe("A DatasetSpec object (version, kind, entity, mode, source, schema?, records).");

// ── push_dataset ──────────────────────────────────────────────────────────
server.tool(
  "push_dataset",
  "Push a DatasetSpec into Kiln. snapshot mode replaces the dataset; append " +
    "mode upserts by upsertKey. Returns the URL of the generated admin UI.",
  {
    spec: specArg,
    project: z.string().optional().describe("Project namespace. Defaults to 'default'."),
  },
  async ({ spec, project }) => {
    const result = validateDatasetSpec(spec);
    if (!result.ok) return fail("DatasetSpec validation failed", result.errors);
    try {
      const stored = await pushDataset(getDb(), result.spec, {
        project,
        schema: result.preview.schema,
      });
      return ok({
        url: datasetUrl(stored.name, stored.project),
        dataset: stored.name,
        project: stored.project,
        mode: stored.mode,
        recordCount: stored.recordCount,
        created: stored.created,
        fields: Object.keys(stored.schema),
      });
    } catch (e) {
      return fail(`Failed to store dataset: ${(e as Error).message}`);
    }
  },
);

// ── append_records ──────────────────────────────────────────────────────────
server.tool(
  "append_records",
  "Append records to an existing dataset, de-duplicating by its upsertKey. " +
    "The dataset must already exist and be in append mode with an upsertKey.",
  {
    name: z.string().describe("The dataset name (source.name it was pushed with)."),
    records: z.array(z.record(z.string(), z.unknown())).describe("Records to append."),
    project: z.string().optional(),
  },
  async ({ name, records, project }) => {
    try {
      const stored = await appendRecords(getDb(), { name, project }, records);
      return ok({
        url: datasetUrl(stored.name, stored.project),
        dataset: stored.name,
        project: stored.project,
        recordCount: stored.recordCount,
      });
    } catch (e) {
      return fail((e as Error).message);
    }
  },
);

// ── validate_dataset_spec ─────────────────────────────────────────────────────
server.tool(
  "validate_dataset_spec",
  "Dry-run: validate a DatasetSpec without storing it, and preview the schema " +
    "Kiln would infer (types, roles, filters) plus per-field statistics.",
  { spec: specArg },
  async ({ spec }) => {
    const result = validateDatasetSpec(spec);
    if (!result.ok) return fail("DatasetSpec validation failed", result.errors);
    return ok({
      valid: true,
      entity: result.spec.entity,
      mode: result.spec.mode,
      recordCount: result.spec.records.length,
      schema: result.preview.schema,
      stats: result.preview.stats,
    });
  },
);

// ── list_datasets ─────────────────────────────────────────────────────────────
server.tool(
  "list_datasets",
  "List datasets in a project with their metadata.",
  { project: z.string().optional() },
  async ({ project }) => {
    try {
      const rows = await listDatasets(getDb(), project ?? "default");
      return ok(
        rows.map((r) => ({
          name: r.name,
          entity: r.entity,
          mode: r.mode,
          recordCount: r.recordCount,
          url: datasetUrl(r.name, r.project),
          updatedAt: r.updatedAt,
        })),
      );
    } catch (e) {
      return fail((e as Error).message);
    }
  },
);

// ── get_dataset ───────────────────────────────────────────────────────────────
server.tool(
  "get_dataset",
  "Fetch a dataset's spec metadata and inferred schema by name or id.",
  {
    name: z.string().optional(),
    id: z.string().optional(),
    project: z.string().optional(),
  },
  async ({ name, id, project }) => {
    try {
      const db = getDb();
      const row = id
        ? await getDatasetById(db, id)
        : name
          ? await getDatasetByName(db, name, project ?? "default")
          : undefined;
      if (!row) return fail("dataset not found (provide a valid name or id)");
      return ok({
        name: row.name,
        project: row.project,
        entity: row.entity,
        mode: row.mode,
        upsertKey: row.upsertKey,
        recordCount: row.recordCount,
        schema: row.schema,
        source: row.source,
        url: datasetUrl(row.name, row.project),
      });
    } catch (e) {
      return fail((e as Error).message);
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr is safe; stdout is the MCP channel.
  console.error("kiln-mcp server running on stdio");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
