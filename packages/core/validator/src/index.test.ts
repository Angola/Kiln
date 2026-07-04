import { describe, expect, it } from "vitest";
import { validateDatasetSpec } from "./index.js";

const good = {
  version: "1.0",
  kind: "dataset",
  entity: "comment",
  source: { name: "t" },
  records: [{ id: "1", body: "hello world" }],
};

describe("validateDatasetSpec", () => {
  it("returns ok with a preview for a valid spec", () => {
    const r = validateDatasetSpec(good);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.spec.mode).toBe("snapshot");
      expect(r.preview.schema.id?.type).toBe("id");
      expect(r.preview.stats.length).toBeGreaterThan(0);
    }
  });

  it("returns flattened errors for an invalid spec", () => {
    const r = validateDatasetSpec({ ...good, mode: "append" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]?.path).toBe("upsertKey");
    }
  });
});
