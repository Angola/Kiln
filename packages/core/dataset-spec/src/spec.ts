import { z } from "zod";
import { Schema } from "./fields.js";

/** How a dataset accumulates data across pushes. See §4.2. */
export const DatasetMode = z.enum(["snapshot", "append"]);
export type DatasetMode = z.infer<typeof DatasetMode>;

/** Where the data came from. Kiln never collects; it only records provenance. */
export const Source = z
  .object({
    /** Transport that delivered the spec. `mcp` is the primary path (§3). */
    type: z.enum(["mcp", "upload", "api"]).default("mcp"),
    /** Identifier of the producing agent, e.g. "claude-code". */
    agent: z.string().optional(),
    /** Stable name of the dataset within the project. */
    name: z.string().min(1),
  })
  .strip();
export type Source = z.infer<typeof Source>;

/** A single record. Kiln treats record values as opaque JSON. */
export const Record = z.record(z.string(), z.unknown());
export type Record = z.infer<typeof Record>;

/**
 * The DatasetSpec — Kiln's only input format (§4). An AI collects and
 * normalizes data on its side, then pushes a DatasetSpec through MCP.
 */
export const DatasetSpec = z
  .object({
    version: z.literal("1.0"),
    kind: z.literal("dataset"),
    /** The thing each record represents, e.g. "comment", "trade". */
    entity: z.string().min(1),
    mode: DatasetMode.default("snapshot"),
    /** Required in append mode: the field used to de-duplicate records. */
    upsertKey: z.string().min(1).optional(),
    source: Source,
    /** Optional field hints; the inferencer completes/overrides gaps (§4.3). */
    schema: Schema.optional(),
    records: z.array(Record),
  })
  .strip()
  .superRefine((spec, ctx) => {
    if (spec.mode === "append" && !spec.upsertKey) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["upsertKey"],
        message: "upsertKey is required when mode is 'append' (§4.2).",
      });
      return;
    }
    if (spec.upsertKey) {
      // Every record must carry the upsert key so de-dup is well defined.
      const missing = spec.records.findIndex(
        (r) => r[spec.upsertKey as string] === undefined,
      );
      if (missing !== -1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["records", missing, spec.upsertKey],
          message: `record[${missing}] is missing upsertKey "${spec.upsertKey}".`,
        });
      }
    }
  });
export type DatasetSpec = z.infer<typeof DatasetSpec>;

/** Input type before defaults are applied (what callers actually send). */
export type DatasetSpecInput = z.input<typeof DatasetSpec>;
