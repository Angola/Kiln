import { describe, expect, it } from "vitest";
import { humanizeLabel, inferSchema } from "./index.js";

describe("inferSchema", () => {
  it("detects core types from values", () => {
    const s = inferSchema([
      {
        id: "a1",
        title: "Hello world",
        score: 42,
        active: true,
        postedAt: "2026-07-04T10:00:00Z",
        day: "2026-07-04",
        homepage: "https://example.com/page",
        avatar: "https://example.com/a.png",
        tags: ["x", "y"],
      },
      {
        id: "a2",
        title: "Second",
        score: 7,
        active: false,
        postedAt: "2026-07-05T11:00:00Z",
        day: "2026-07-05",
        homepage: "https://example.com/other",
        avatar: "https://example.com/b.jpg",
        tags: ["y"],
      },
    ]);

    expect(s.id?.type).toBe("id");
    expect(s.id?.role).toBe("id");
    // "title" values are all-unique short strings → not a category (which must
    // repeat); it keeps its title role via the key name.
    expect(s.title?.role).toBe("title");
    expect(s.score?.type).toBe("number");
    expect(s.score?.filter).toBe("range");
    expect(s.active?.type).toBe("boolean");
    expect(s.active?.filter).toBe("toggle");
    expect(s.postedAt?.type).toBe("datetime");
    expect(s.postedAt?.filter).toBe("dateRange");
    expect(s.day?.type).toBe("date");
    expect(s.homepage?.type).toBe("url");
    expect(s.avatar?.type).toBe("image");
    expect(s.tags?.type).toBe("array");
    expect(s.tags?.filter).toBe("multiSelect");
  });

  it("classifies long strings as text with search filter", () => {
    const long = "x".repeat(200);
    const s = inferSchema([{ body: long }, { body: long + "y" }]);
    expect(s.body?.type).toBe("text");
    expect(s.body?.filter).toBe("search");
    expect(s.body?.role).toBe("description");
  });

  it("classifies low-cardinality categories as select", () => {
    const s = inferSchema(
      Array.from({ length: 20 }, (_, i) => ({ status: i % 2 ? "open" : "closed" })),
    );
    expect(s.status?.type).toBe("category");
    expect(s.status?.filter).toBe("select");
    expect(s.status?.enumValues).toEqual(["closed", "open"]);
  });

  it("treats all-unique medium strings as free text, not a category", () => {
    // Dense, unique comment-like strings (short in chars, clearly prose).
    const rows = Array.from({ length: 15 }, (_, i) => ({
      note: `固有のコメント番号${i}、それぞれ内容が違う短い文章です。`,
    }));
    const s = inferSchema(rows);
    expect(s.note?.type).toBe("text");
    expect(s.note?.filter).toBe("search");
    expect(s.note?.enumValues).toBeUndefined();
  });

  it("only treats repeating low-cardinality strings as categories", () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ tag: `t${i % 3}` }));
    const s = inferSchema(rows);
    expect(s.tag?.type).toBe("category");
    expect(s.tag?.filter).toBe("select");
  });

  it("lets AI hints win over inference (§4.3)", () => {
    const s = inferSchema(
      [{ label: "1" }, { label: "2" }],
      { label: { type: "id", role: "id" } },
    );
    expect(s.label?.type).toBe("id");
    expect(s.label?.role).toBe("id");
  });

  it("keeps hint-only fields not present in records", () => {
    const s = inferSchema([{ a: 1 }], { computed: { type: "number", role: "metric" } });
    expect(s.computed?.type).toBe("number");
  });

  it("marks nullable fields", () => {
    const s = inferSchema([{ a: 1 }, {}]);
    expect(s.a?.nullable).toBe(true);
  });

  it("humanizes labels", () => {
    expect(humanizeLabel("postedAt")).toBe("Posted At");
    expect(humanizeLabel("user_name")).toBe("User Name");
  });
});
