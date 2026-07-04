# 🔥 Kiln

**Data goes in, an admin UI comes out.**

Kiln is a runtime that receives structured data an AI has already collected and
normalized, and auto-generates a full admin surface for it — table, filters,
search, sort, pagination, detail view, and chart candidates. Like a pottery
kiln, the shape is given by the kiln, not the clay: Kiln is infrastructure, not
the artifact.

The AI's job is to **collect and normalize**. Kiln's job is everything after:
validate → infer schema → plan UI → render. Kiln never scrapes, never asks an
AI to write React/HTML/CSS, and never becomes a general ETL tool.

> This is the Phase 1 (MCP-first MVP) implementation. See [`DESIGN.md`](./DESIGN.md)
> for the full design and roadmap.

## How it works

```
AI agent (Claude Code, …)          ← collects + normalizes data
      │  push_dataset / append_records (MCP)
      ▼
kiln-mcp  ──►  Validator (Zod)  ──►  Schema Inferencer  ──►  UI Planner
      │                                                          │
      ▼                                                          ▼
Postgres (raw_specs · datasets · records)              Next.js admin UI
```

An agent pushes a **DatasetSpec** through the MCP server; Kiln stores it,
infers the schema (types, roles, filters), and the Next.js app renders a
filterable admin screen at a URL the agent gets back. Filtering, sorting and
search all run in Postgres (`§8.1`), so the browser stays thin.

## Repository layout

| Package | What it is |
| --- | --- |
| `packages/core/dataset-spec` | `DatasetSpec` types + Zod schema (`mode`, `upsertKey`) |
| `packages/core/schema-inferencer` | Type / role / filter inference from records (§5) |
| `packages/core/validator` | Validate a spec + produce a dry-run inference preview |
| `packages/core/ui-planner` | Pure schema → UI plan (columns, filters, detail, charts) |
| `packages/db` | Drizzle schema + repository + SQL-side record queries |
| `packages/renderer-react` | `AutoTable` / `AutoFilters` / `AutoDetail` / `AutoChart` / `DatasetExplorer` + Storybook |
| `apps/mcp` | The `kiln-mcp` MCP server (stdio) |
| `apps/web` | Next.js App Router viewer |

The `core` and `renderer-react` packages are framework-agnostic by design so a
`@kiln/renderer-vue` could be added later without touching them.

## Quick start

Requirements: Node ≥ 20, pnpm 10, a Postgres instance.

```bash
pnpm install
cp .env.example .env         # set DATABASE_URL

# create the kiln schema + tables
export DATABASE_URL=postgresql://postgres@localhost:5432/kiln
pnpm build
pnpm --filter @kiln/db migrate

# run the viewer
pnpm dev:web                 # http://localhost:3000
```

### Push the sample dataset

Register the MCP server with your agent (stdio):

```json
{
  "mcpServers": {
    "kiln": {
      "command": "node",
      "args": ["/absolute/path/to/kiln/apps/mcp/dist/index.js"],
      "env": {
        "DATABASE_URL": "postgresql://postgres@localhost:5432/kiln",
        "KILN_WEB_URL": "http://localhost:3000"
      }
    }
  }
}
```

Then call `push_dataset` with the contents of
[`examples/sukikirai-comments.json`](./examples/sukikirai-comments.json). The
tool returns a URL — open it and the filterable table is already there.

## MCP tools

| Tool | Purpose |
| --- | --- |
| `push_dataset` | Store a DatasetSpec (snapshot replaces; append upserts by `upsertKey`) |
| `append_records` | Append/upsert records into an existing dataset |
| `validate_dataset_spec` | Dry-run: validate + preview the inferred schema, without storing |
| `list_datasets` | List datasets in a project |
| `get_dataset` | Fetch a dataset's metadata + inferred schema |

Kiln deliberately has **no** collection tools — collecting data is the agent's
job, on its side of the boundary.

## Development

```bash
pnpm test          # build packages, then run all unit tests
pnpm typecheck     # type-check every package
pnpm storybook     # renderer-react component gallery (localhost:6006)
```

The `@kiln/db` integration tests only run when `DATABASE_URL` is set; otherwise
they're skipped.
