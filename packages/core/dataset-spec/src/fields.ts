import { z } from "zod";

/**
 * Inferred/declared data type of a single field. Mirrors §5 of DESIGN.md.
 *
 * These are semantic types, not JS types: `url`, `image`, `category`, `id`
 * and `text` all serialize as strings but drive different UI treatment.
 */
export const FieldType = z.enum([
  "string",
  "number",
  "boolean",
  "date",
  "datetime",
  "array",
  "url",
  "image",
  "category",
  "text",
  "id",
]);
export type FieldType = z.infer<typeof FieldType>;

/**
 * The semantic role a field plays in the dataset. Roles let the UI Planner
 * pick a title, a primary timestamp, the identity column, metrics to chart,
 * etc. — independent of the raw {@link FieldType}.
 */
export const FieldRole = z.enum([
  "id",
  "title",
  "time",
  "category",
  "metric",
  "link",
  "image",
  "description",
  "tag",
]);
export type FieldRole = z.infer<typeof FieldRole>;

/**
 * The filter control generated for a field. Mirrors the "フィルタ自動生成"
 * table in §5.
 */
export const FilterType = z.enum([
  "select",
  "search",
  "range",
  "dateRange",
  "toggle",
  "multiSelect",
]);
export type FilterType = z.infer<typeof FilterType>;

/**
 * Per-field specification. Every attribute is optional so an AI may send a
 * partial hint; the Schema Inferencer fills in the rest (§4.3).
 */
export const FieldSpec = z
  .object({
    type: FieldType,
    role: FieldRole.optional(),
    filter: FilterType.optional(),
    /** Human-friendly column label. Defaults to the field key. */
    label: z.string().optional(),
    /** Enumerated values, when known (drives select/multiSelect options). */
    enumValues: z.array(z.string()).optional(),
    /** Whether the field may be absent/null in some records. */
    nullable: z.boolean().optional(),
  })
  .strict();
export type FieldSpec = z.infer<typeof FieldSpec>;

/** A full schema: field key → {@link FieldSpec}. */
export const Schema = z.record(z.string(), FieldSpec);
export type Schema = z.infer<typeof Schema>;
