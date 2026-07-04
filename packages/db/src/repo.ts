import type { DatasetSpec, Schema } from "@kiln/dataset-spec";
import { inferSchema } from "@kiln/schema-inferencer";
import { and, count, desc, eq, sql } from "drizzle-orm";
import type { DbClient } from "./client.js";
import { datasets, rawSpecs, records } from "./schema.js";
import type { DatasetRow } from "./schema.js";

export interface PushResult {
  id: string;
  name: string;
  project: string;
  mode: string;
  recordCount: number;
  schema: Schema;
  created: boolean;
}

function mergeSchemas(existing: Schema, incoming: Schema): Schema {
  // Existing (already-stabilised) definitions win; new fields are added (§8.1).
  return { ...incoming, ...existing };
}

function rowsFor(datasetId: string, spec: DatasetSpec) {
  const key = spec.upsertKey;
  return spec.records.map((r) => ({
    datasetId,
    data: r,
    upsertKey: key != null && r[key] != null ? String(r[key]) : null,
  }));
}

/**
 * Store a DatasetSpec (§6.1 push_dataset). snapshot replaces all records;
 * append upserts by upsertKey. The raw payload is always archived first.
 */
export async function pushDataset(
  db: DbClient,
  spec: DatasetSpec,
  opts: { project?: string; schema?: Schema } = {},
): Promise<PushResult> {
  const project = opts.project ?? "default";
  const inferred = opts.schema ?? inferSchema(spec.records, spec.schema);

  return db.transaction(async (tx) => {
    const [raw] = await tx
      .insert(rawSpecs)
      .values({
        datasetName: spec.source.name,
        entity: spec.entity,
        mode: spec.mode,
        payload: spec,
      })
      .returning({ id: rawSpecs.id });

    const existing = await tx.query.datasets.findFirst({
      where: and(eq(datasets.project, project), eq(datasets.name, spec.source.name)),
    });

    let datasetId: string;
    let schema: Schema;
    let created: boolean;

    if (!existing) {
      schema = inferred;
      const [row] = await tx
        .insert(datasets)
        .values({
          project,
          name: spec.source.name,
          entity: spec.entity,
          mode: spec.mode,
          upsertKey: spec.upsertKey ?? null,
          schema,
          source: spec.source,
        })
        .returning({ id: datasets.id });
      datasetId = row!.id;
      created = true;
    } else {
      datasetId = existing.id;
      created = false;
      schema =
        spec.mode === "append"
          ? mergeSchemas(existing.schema, inferred)
          : inferred;
      await tx
        .update(datasets)
        .set({
          entity: spec.entity,
          mode: spec.mode,
          upsertKey: spec.upsertKey ?? existing.upsertKey,
          schema,
          source: spec.source,
          updatedAt: sql`now()`,
        })
        .where(eq(datasets.id, datasetId));
    }

    if (spec.mode === "snapshot") {
      await tx.delete(records).where(eq(records.datasetId, datasetId));
    }

    const values = rowsFor(datasetId, spec);
    if (values.length > 0) {
      if (spec.mode === "append" && spec.upsertKey) {
        await tx
          .insert(records)
          .values(values)
          .onConflictDoUpdate({
            target: [records.datasetId, records.upsertKey],
            targetWhere: sql`${records.upsertKey} is not null`,
            set: { data: sql`excluded.data` },
          });
      } else {
        await tx.insert(records).values(values);
      }
    }

    const countRows = await tx
      .select({ n: count() })
      .from(records)
      .where(eq(records.datasetId, datasetId));
    const n = countRows[0]?.n ?? 0;

    await tx
      .update(datasets)
      .set({ recordCount: n, updatedAt: sql`now()` })
      .where(eq(datasets.id, datasetId));

    await tx
      .update(rawSpecs)
      .set({ datasetId })
      .where(eq(rawSpecs.id, raw!.id));

    return {
      id: datasetId,
      name: spec.source.name,
      project,
      mode: spec.mode,
      recordCount: n,
      schema,
      created,
    };
  });
}

/** Append records to an existing dataset (§6.1 append_records). */
export async function appendRecords(
  db: DbClient,
  ref: { project?: string; name: string },
  newRecords: Record<string, unknown>[],
): Promise<PushResult> {
  const project = ref.project ?? "default";
  const existing = await db.query.datasets.findFirst({
    where: and(eq(datasets.project, project), eq(datasets.name, ref.name)),
  });
  if (!existing) {
    throw new Error(`dataset "${ref.name}" not found in project "${project}".`);
  }
  const spec: DatasetSpec = {
    version: "1.0",
    kind: "dataset",
    entity: existing.entity,
    mode: "append",
    upsertKey: existing.upsertKey ?? undefined,
    source: existing.source,
    records: newRecords,
  };
  if (!spec.upsertKey) {
    throw new Error(
      `dataset "${ref.name}" has no upsertKey; append requires one (§4.2).`,
    );
  }
  return pushDataset(db, spec, { project });
}

export async function listDatasets(
  db: DbClient,
  project = "default",
): Promise<DatasetRow[]> {
  return db
    .select()
    .from(datasets)
    .where(eq(datasets.project, project))
    .orderBy(desc(datasets.updatedAt));
}

export async function getDatasetByName(
  db: DbClient,
  name: string,
  project = "default",
): Promise<DatasetRow | undefined> {
  return db.query.datasets.findFirst({
    where: and(eq(datasets.project, project), eq(datasets.name, name)),
  });
}

export async function getDatasetById(
  db: DbClient,
  id: string,
): Promise<DatasetRow | undefined> {
  return db.query.datasets.findFirst({ where: eq(datasets.id, id) });
}
