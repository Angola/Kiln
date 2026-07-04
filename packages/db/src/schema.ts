import type { Schema, Source } from "@kiln/dataset-spec";
import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/** All Kiln tables live in a dedicated `kiln` schema in the shared Postgres
 * instance (§8, §8.1). */
export const kiln = pgSchema("kiln");

/**
 * raw_specs — immutable, append-only. The exact DatasetSpec payload an AI
 * sent, kept verbatim for replay/audit/debug (§8.1). Never updated.
 */
export const rawSpecs = kiln.table("raw_specs", {
  id: uuid("id").defaultRandom().primaryKey(),
  datasetId: uuid("dataset_id"),
  datasetName: text("dataset_name").notNull(),
  entity: text("entity").notNull(),
  mode: text("mode").notNull(),
  /** The full DatasetSpec as received. */
  payload: jsonb("payload").$type<unknown>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * datasets — one row per logical dataset. Holds current metadata and the
 * (inferred + hinted) schema Kiln renders from.
 */
export const datasets = kiln.table(
  "datasets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    project: text("project").notNull().default("default"),
    name: text("name").notNull(),
    entity: text("entity").notNull(),
    mode: text("mode").notNull().default("snapshot"),
    upsertKey: text("upsert_key"),
    schema: jsonb("schema").$type<Schema>().notNull(),
    source: jsonb("source").$type<Source>().notNull(),
    recordCount: integer("record_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    projectNameUq: uniqueIndex("datasets_project_name_uq").on(
      t.project,
      t.name,
    ),
  }),
);

/**
 * records — one row per record. Filtering, sorting and full-text search all
 * run in Postgres against the `data` JSONB column (GIN-indexed) so the client
 * stays thin (§8.1). append/upsert de-dup uses (dataset_id, upsert_key).
 */
export const records = kiln.table(
  "records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    datasetId: uuid("dataset_id")
      .notNull()
      .references(() => datasets.id, { onDelete: "cascade" }),
    /** Stringified value of the dataset's upsertKey for this record (append). */
    upsertKey: text("upsert_key"),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    datasetIdx: index("records_dataset_idx").on(t.datasetId),
    dataGin: index("records_data_gin").using("gin", t.data),
    upsertUq: uniqueIndex("records_dataset_upsert_uq")
      .on(t.datasetId, t.upsertKey)
      .where(sql`${t.upsertKey} is not null`),
  }),
);

export type DatasetRow = typeof datasets.$inferSelect;
export type RecordRow = typeof records.$inferSelect;
export type RawSpecRow = typeof rawSpecs.$inferSelect;
