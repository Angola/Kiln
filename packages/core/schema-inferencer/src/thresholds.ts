/** Tunable heuristics for schema inference (§5). Kept in one place so the
 * inferencer's behaviour can be re-tuned and datasets re-inferred (§8.1). */
export const THRESHOLDS = {
  /** A string field is a `category` only when its distinct-value count is at or
   * below this AND values are short AND they actually repeat (see ratio). */
  categoryMaxUnique: 25,
  /** Category values must be shorter than this (chars) on average. */
  categoryMaxAvgLen: 40,
  /** A category must repeat: distinct/present must be at or below this ratio.
   * An all-unique column is never a category (it's an id or free text). */
  categoryMaxUniqueRatio: 0.6,
  /** A string field becomes `text` (long-form) when the average length of its
   * values exceeds this. */
  textMinAvgLen: 80,
  /** Mostly-unique medium-length strings (e.g. CJK comments, which are dense
   * so short in chars) are free text: ratio ≥ this AND avg length ≥
   * freeTextMinAvgLen → `text`. */
  freeTextMinRatio: 0.85,
  freeTextMinAvgLen: 16,
  /** Select vs. search: a string/category field gets a `select` filter only
   * when its distinct count is at or below this AND it repeats. */
  selectMaxOptions: 30,
} as const;
