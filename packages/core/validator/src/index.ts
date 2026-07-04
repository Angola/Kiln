import {
  DatasetSpec,
  type DatasetSpecInput,
  type Schema,
} from "@kiln/dataset-spec";
import {
  type FieldStats,
  inferSchemaWithStats,
} from "@kiln/schema-inferencer";

export interface ValidationError {
  path: string;
  message: string;
}

export type ValidationResult =
  | {
      ok: true;
      /** The parsed spec with defaults applied. */
      spec: DatasetSpec;
      /** Inference preview: the schema Kiln will use, plus per-field stats. */
      preview: { schema: Schema; stats: FieldStats[] };
    }
  | {
      ok: false;
      errors: ValidationError[];
    };

/**
 * Validate a DatasetSpec and produce the inference preview in one pass.
 * Powers both `push_dataset` (validate-then-store) and the
 * `validate_dataset_spec` dry-run (§6.1).
 */
export function validateDatasetSpec(input: unknown): ValidationResult {
  const parsed = DatasetSpec.safeParse(input as DatasetSpecInput);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => ({
        path: i.path.length ? i.path.join(".") : "(root)",
        message: i.message,
      })),
    };
  }

  const spec = parsed.data;
  const preview = inferSchemaWithStats(spec.records, spec.schema);
  return { ok: true, spec, preview };
}
