import type { Schema } from "@kiln/dataset-spec";
import { describe, expect, it } from "vitest";
import { planUI } from "./index.js";

const schema: Schema = {
  id: { type: "id", role: "id", label: "Id" },
  title: { type: "string", role: "title", label: "Title" },
  status: { type: "category", role: "category", filter: "select", label: "Status", enumValues: ["open", "closed"] },
  pnl: { type: "number", role: "metric", filter: "range", label: "Pnl" },
  postedAt: { type: "datetime", role: "time", filter: "dateRange", label: "Posted At" },
  avatar: { type: "image", role: "image", label: "Avatar" },
  body: { type: "text", role: "description", filter: "search", label: "Body" },
};

describe("planUI", () => {
  it("identifies primary/title/time fields", () => {
    const plan = planUI(schema);
    expect(plan.primaryKey).toBe("id");
    expect(plan.titleField).toBe("title");
    expect(plan.timeField).toBe("postedAt");
  });

  it("marks the title column primary and orders title first", () => {
    const plan = planUI(schema);
    expect(plan.columns[0]?.key).toBe("title");
    expect(plan.columns[0]?.primary).toBe(true);
  });

  it("maps types to displays", () => {
    const plan = planUI(schema);
    const byKey = Object.fromEntries(plan.detail.fields.map((f) => [f.key, f.display]));
    expect(byKey.avatar).toBe("thumbnail");
    expect(byKey.status).toBe("badge");
    expect(byKey.body).toBe("longtext");
    expect(byKey.postedAt).toBe("datetime");
  });

  it("emits filters only for filterable fields", () => {
    const plan = planUI(schema);
    const keys = plan.filters.map((f) => f.key).sort();
    expect(keys).toEqual(["body", "pnl", "postedAt", "status"]);
  });

  it("suggests a line chart for time × metric on append datasets", () => {
    const plan = planUI(schema, { mode: "append" });
    const line = plan.charts.find((c) => c.kind === "line");
    expect(line?.x).toBe("postedAt");
    expect(line?.y).toBe("pnl");
  });

  it("suggests a bar chart for category × metric", () => {
    const plan = planUI(schema);
    const bar = plan.charts.find((c) => c.kind === "bar");
    expect(bar?.x).toBe("status");
    expect(bar?.y).toBe("pnl");
  });
});
