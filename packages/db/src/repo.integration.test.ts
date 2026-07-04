import { DatasetSpec } from "@kiln/dataset-spec";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDb, type DbClient } from "./client.js";
import { queryRecords } from "./query.js";
import { appendRecords, getDatasetByName, listDatasets, pushDataset } from "./repo.js";
import { datasets } from "./schema.js";
import { eq } from "drizzle-orm";

const url = process.env.DATABASE_URL;
const d = url ? describe : describe.skip;

d("repo (integration)", () => {
  let db: DbClient;
  const project = "test-repo";

  beforeAll(async () => {
    db = createDb(url!);
    await db.delete(datasets).where(eq(datasets.project, project));
  });

  afterAll(async () => {
    await db.delete(datasets).where(eq(datasets.project, project));
    await db.$sql.end();
  });

  it("pushes a snapshot and queries it back", async () => {
    const spec = DatasetSpec.parse({
      version: "1.0",
      kind: "dataset",
      entity: "comment",
      source: { name: "snap-1" },
      records: [
        { id: "1", target: "A", sentiment: "like" },
        { id: "2", target: "B", sentiment: "dislike" },
        { id: "3", target: "A", sentiment: "like" },
      ],
    });
    const res = await pushDataset(db, spec, { project });
    expect(res.created).toBe(true);
    expect(res.recordCount).toBe(3);

    const q = await queryRecords(db, res.id, {
      filters: [{ key: "sentiment", kind: "select", value: "like" }],
    });
    expect(q.total).toBe(2);
  });

  it("replaces records on snapshot re-push", async () => {
    const spec = DatasetSpec.parse({
      version: "1.0",
      kind: "dataset",
      entity: "comment",
      source: { name: "snap-1" },
      records: [{ id: "9", target: "Z", sentiment: "like" }],
    });
    const res = await pushDataset(db, spec, { project });
    expect(res.created).toBe(false);
    expect(res.recordCount).toBe(1);
  });

  it("appends and upserts by key", async () => {
    const spec = DatasetSpec.parse({
      version: "1.0",
      kind: "dataset",
      entity: "trade",
      mode: "append",
      upsertKey: "id",
      source: { name: "log-1" },
      records: [
        { id: "t1", pnl: 10 },
        { id: "t2", pnl: -5 },
      ],
    });
    const first = await pushDataset(db, spec, { project });
    expect(first.recordCount).toBe(2);

    // Re-send t2 with a new value + add t3 → upsert, not duplicate.
    const second = await appendRecords(db, { project, name: "log-1" }, [
      { id: "t2", pnl: 99 },
      { id: "t3", pnl: 3 },
    ]);
    expect(second.recordCount).toBe(3);

    const ds = await getDatasetByName(db, "log-1", project);
    const q = await queryRecords(db, ds!.id, {
      filters: [{ key: "id", kind: "select", value: "t2" }],
    });
    expect(q.rows[0]?.pnl).toBe(99);
  });

  it("supports range and sort", async () => {
    const ds = await getDatasetByName(db, "log-1", project);
    const q = await queryRecords(db, ds!.id, {
      filters: [{ key: "pnl", kind: "range", min: 0 }],
      sort: { key: "pnl", dir: "desc", cast: "numeric" },
    });
    expect(q.total).toBe(3); // t1=10, t2=99, t3=3
    expect(q.rows[0]?.pnl).toBe(99); // sorted desc
  });

  it("lists datasets in the project", async () => {
    const list = await listDatasets(db, project);
    expect(list.map((d) => d.name).sort()).toEqual(["log-1", "snap-1"]);
  });
});
