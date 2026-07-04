# Changelog

All notable changes to Kiln are recorded here. Human-readable by intent — this
doubles as source material for write-ups (§9).

## [0.1.0] — Phase 1: MCP-first MVP

The first working slice of the design: **an agent pushes a DatasetSpec and gets
back a URL that already shows a filterable admin table.**

### Added

- **`@kiln/dataset-spec`** — `DatasetSpec` types + Zod schema, including `mode`
  (`snapshot` / `append`) and `upsertKey`, with validation that `append`
  requires an `upsertKey` present on every record (§4.2).
- **`@kiln/schema-inferencer`** — infers `type` / `role` / `filter` for every
  field from the records (§5). AI-supplied hints win over inference (§4.3). A
  uniqueness-ratio guard keeps all-unique free text (including dense CJK prose
  that is short in character count) from being mis-classified as a category.
- **`@kiln/validator`** — validates a spec and returns a dry-run inference
  preview (schema + per-field stats) in one pass.
- **`@kiln/ui-planner`** — pure `schema → UIPlan`: table columns, filter
  controls, detail layout, and chart candidates (line for time×metric, bar for
  category×metric, pie for category counts).
- **`@kiln/db`** — Drizzle schema with the two-layer design (§8.1):
  `raw_specs` (immutable payload archive), `datasets` (metadata + current
  schema), and `records` (one row per record, GIN-indexed `data`). Repository
  with snapshot-replace / append-upsert, plus SQL-side filter / search / sort /
  paginate.
- **`@kiln/mcp`** — the `kiln-mcp` stdio server exposing exactly five tools:
  `push_dataset`, `append_records`, `validate_dataset_spec`, `list_datasets`,
  `get_dataset`. No collection tools — by design.
- **`@kiln/renderer-react`** — `AutoTable`, `AutoFilters`, `AutoDetail` /
  `DetailModal`, `AutoChart`, and the composed `DatasetExplorer`, with a
  Storybook gallery covering the inference patterns (categories, url/image
  columns, long text, datetime + metric with charts).
- **`@kiln/web`** — Next.js App Router viewer: dataset list, dataset page, and a
  records query API. Filtering/sorting/paging are delegated to Postgres via the
  query API (§8.1); the browser stays thin.
- **`examples/sukikirai-comments.json`** — the Phase 1 acceptance dataset.

### Phase 1 acceptance

Pushing `sukikirai-comments` (18 records) through `push_dataset` returns a URL
that renders a filterable, sortable table with a detail modal and inferred
charts. Selecting a filter (e.g. `sentiment = dislike`) narrows the table via a
SQL-side query. ✅
