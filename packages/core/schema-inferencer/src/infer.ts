import type {
  FieldRole,
  FieldSpec,
  FieldType,
  FilterType,
  Schema,
} from "@kiln/dataset-spec";
import {
  isDateOnly,
  isDateTime,
  isImageUrl,
  isUrl,
  looksLikeIdKey,
  looksLikeImageKey,
  looksLikeTitleKey,
} from "./detectors.js";
import { THRESHOLDS } from "./thresholds.js";

type Row = Record<string, unknown>;

export interface FieldStats {
  key: string;
  present: number;
  total: number;
  distinct: number;
  nullable: boolean;
  sampleValues: unknown[];
}

export interface InferenceResult {
  schema: Schema;
  stats: FieldStats[];
}

/** Turn a field key into a human label: `postedAt` → "Posted At". */
export function humanizeLabel(key: string): string {
  const spaced = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  return spaced
    .split(" ")
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function collectKeys(records: Row[]): string[] {
  const keys = new Set<string>();
  for (const r of records) for (const k of Object.keys(r)) keys.add(k);
  return [...keys];
}

function isPresent(v: unknown): boolean {
  return v !== undefined && v !== null && v !== "";
}

interface Analyzed {
  values: unknown[];
  present: number;
  total: number;
  distinct: number;
  avgLen: number;
  allBoolean: boolean;
  allNumber: boolean;
  anyArray: boolean;
  anyObject: boolean;
  allString: boolean;
  distinctStrings: string[];
}

function analyze(records: Row[], key: string): Analyzed {
  const total = records.length;
  const values: unknown[] = [];
  const distinctSet = new Set<string>();
  let lenSum = 0;
  let strCount = 0;
  let allBoolean = true;
  let allNumber = true;
  let anyArray = false;
  let anyObject = false;
  let allString = true;

  for (const r of records) {
    const v = r[key];
    if (!isPresent(v)) continue;
    values.push(v);
    distinctSet.add(typeof v === "object" ? JSON.stringify(v) : String(v));
    if (typeof v !== "boolean") allBoolean = false;
    if (typeof v !== "number") allNumber = false;
    if (Array.isArray(v)) anyArray = true;
    else if (typeof v === "object") anyObject = true;
    if (typeof v === "string") {
      strCount++;
      lenSum += v.length;
    } else {
      allString = false;
    }
  }

  const present = values.length;
  return {
    values,
    present,
    total,
    distinct: distinctSet.size,
    avgLen: strCount > 0 ? lenSum / strCount : 0,
    allBoolean: present > 0 && allBoolean,
    allNumber: present > 0 && allNumber,
    anyArray,
    anyObject,
    allString: present > 0 && allString,
    distinctStrings: [...distinctSet],
  };
}

function classifyType(key: string, a: Analyzed): FieldType {
  if (a.present === 0) return "string";
  if (a.allBoolean) return "boolean";
  if (a.allNumber) {
    return looksLikeIdKey(key) && a.distinct === a.present ? "id" : "number";
  }
  if (a.anyArray) return "array";
  if (a.anyObject) return "text";

  // String family.
  if (looksLikeIdKey(key) && a.distinct === a.present) return "id";

  const strings = a.values.filter((v): v is string => typeof v === "string");
  const all = (fn: (s: string) => boolean) => strings.every(fn);
  const ratio = a.present > 0 ? a.distinct / a.present : 0;

  if (looksLikeImageKey(key) && all(isUrl)) return "image";
  if (all(isImageUrl)) return "image";
  if (all(isUrl)) return "url";
  if (all(isDateTime)) return "datetime";
  if (all(isDateOnly)) return "date";
  if (a.avgLen > THRESHOLDS.textMinAvgLen) return "text";
  if (
    ratio <= THRESHOLDS.categoryMaxUniqueRatio &&
    a.distinct <= THRESHOLDS.categoryMaxUnique &&
    a.avgLen <= THRESHOLDS.categoryMaxAvgLen
  ) {
    return "category";
  }
  // Mostly-unique medium-length strings are free text, not categories. This
  // catches dense CJK comments that are short in char count but clearly prose.
  if (ratio >= THRESHOLDS.freeTextMinRatio && a.avgLen >= THRESHOLDS.freeTextMinAvgLen) {
    return "text";
  }
  return "string";
}

function classifyRole(
  key: string,
  type: FieldType,
): FieldRole | undefined {
  switch (type) {
    case "id":
      return "id";
    case "datetime":
    case "date":
      return "time";
    case "number":
      return "metric";
    case "url":
      return "link";
    case "image":
      return "image";
    case "text":
      return "description";
    case "category":
      return "category";
    case "string":
      return looksLikeTitleKey(key) ? "title" : undefined;
    default:
      return undefined;
  }
}

function classifyFilter(type: FieldType, a: Analyzed): FilterType | undefined {
  switch (type) {
    case "boolean":
      return "toggle";
    case "number":
      return "range";
    case "date":
    case "datetime":
      return "dateRange";
    case "array":
      return "multiSelect";
    case "category":
      return "select";
    case "text":
      return "search";
    case "url":
    case "image":
    case "id":
      return undefined; // display-only columns
    case "string": {
      const ratio = a.present > 0 ? a.distinct / a.present : 0;
      return a.distinct <= THRESHOLDS.selectMaxOptions &&
        ratio <= THRESHOLDS.categoryMaxUniqueRatio
        ? "select"
        : "search";
    }
    default:
      return undefined;
  }
}

function enumValuesFor(type: FieldType, a: Analyzed): string[] | undefined {
  const ratio = a.present > 0 ? a.distinct / a.present : 0;
  const stringSelect =
    type === "string" &&
    a.distinct <= THRESHOLDS.selectMaxOptions &&
    ratio <= THRESHOLDS.categoryMaxUniqueRatio;
  if (type === "category" || stringSelect) {
    return [...a.distinctStrings].sort();
  }
  if (type === "array") {
    const opts = new Set<string>();
    for (const v of a.values) {
      if (Array.isArray(v)) for (const el of v) opts.add(String(el));
    }
    return opts.size <= THRESHOLDS.selectMaxOptions ? [...opts].sort() : undefined;
  }
  return undefined;
}

function inferField(key: string, a: Analyzed): FieldSpec {
  const type = classifyType(key, a);
  const spec: FieldSpec = {
    type,
    label: humanizeLabel(key),
  };
  const role = classifyRole(key, type);
  if (role) spec.role = role;
  const filter = classifyFilter(type, a);
  if (filter) spec.filter = filter;
  const enumValues = enumValuesFor(type, a);
  if (enumValues) spec.enumValues = enumValues;
  if (a.present < a.total) spec.nullable = true;
  return spec;
}

/**
 * Infer a complete {@link Schema} from records, then overlay AI-provided
 * hints (hints win — §4.3). Fields present only in hints are kept as-is.
 */
export function inferSchema(records: Row[], hints?: Schema): Schema {
  return inferSchemaWithStats(records, hints).schema;
}

export function inferSchemaWithStats(
  records: Row[],
  hints?: Schema,
): InferenceResult {
  const recordKeys = collectKeys(records);
  const hintKeys = hints ? Object.keys(hints) : [];
  const keys = [...new Set([...recordKeys, ...hintKeys])];

  const schema: Schema = {};
  const stats: FieldStats[] = [];

  for (const key of keys) {
    const a = analyze(records, key);
    const inferred = recordKeys.includes(key)
      ? inferField(key, a)
      : { type: "string" as FieldType, label: humanizeLabel(key) };

    const hint = hints?.[key];
    // AI hints win, but only for the attributes the AI actually specified.
    const merged: FieldSpec = { ...inferred, ...(hint ?? {}) };
    schema[key] = merged;

    stats.push({
      key,
      present: a.present,
      total: a.total,
      distinct: a.distinct,
      nullable: a.present < a.total,
      sampleValues: a.values.slice(0, 5),
    });
  }

  return { schema, stats };
}
