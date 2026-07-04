import { describe, expect, it } from "vitest";
import { DatasetSpec } from "./index.js";

const base = {
  version: "1.0" as const,
  kind: "dataset" as const,
  entity: "comment",
  source: { name: "test" },
  records: [{ id: "1", body: "hi" }],
};

describe("DatasetSpec", () => {
  it("accepts a minimal snapshot spec and defaults mode", () => {
    const parsed = DatasetSpec.parse(base);
    expect(parsed.mode).toBe("snapshot");
    expect(parsed.source.type).toBe("mcp");
  });

  it("requires upsertKey in append mode", () => {
    const r = DatasetSpec.safeParse({ ...base, mode: "append" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.path).toEqual(["upsertKey"]);
    }
  });

  it("accepts append mode with a valid upsertKey", () => {
    const r = DatasetSpec.safeParse({
      ...base,
      mode: "append",
      upsertKey: "id",
    });
    expect(r.success).toBe(true);
  });

  it("rejects append records missing the upsertKey", () => {
    const r = DatasetSpec.safeParse({
      ...base,
      mode: "append",
      upsertKey: "id",
      records: [{ body: "no id here" }],
    });
    expect(r.success).toBe(false);
  });

  it("rejects unknown field types in schema hints", () => {
    const r = DatasetSpec.safeParse({
      ...base,
      schema: { id: { type: "uuid" } },
    });
    expect(r.success).toBe(false);
  });

  it("carries schema hints through untouched", () => {
    const parsed = DatasetSpec.parse({
      ...base,
      schema: { postedAt: { type: "datetime", role: "time", filter: "dateRange" } },
    });
    expect(parsed.schema?.postedAt?.filter).toBe("dateRange");
  });
});
