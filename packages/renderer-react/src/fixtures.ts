import { inferSchema } from "@kiln/schema-inferencer";
import { type PlanOptions, planUI } from "@kiln/ui-planner";
import type { Row } from "./AutoTable.js";

/** Build a plan from raw rows exactly as the runtime does (infer → plan),
 * so stories double as regression fixtures for the inference pipeline (§8). */
export function planFromRows(rows: Row[], opts?: PlanOptions) {
  const schema = inferSchema(rows, undefined);
  return { schema, plan: planUI(schema, opts) };
}

export const comments: Row[] = [
  { id: "c001", target: "パクチー", sentiment: "like", body: "香りが最高。エスニック料理には欠かせない。", author: "midori", postedAt: "2026-06-01T09:12:00Z", upvotes: 42, sourceUrl: "https://example.com/1" },
  { id: "c002", target: "パクチー", sentiment: "dislike", body: "無理。石鹸を食べているみたいな味がして受け付けない。", author: "kenta", postedAt: "2026-06-01T10:03:00Z", upvotes: 88, sourceUrl: "https://example.com/2" },
  { id: "c003", target: "きのこの山", sentiment: "like", body: "チョコとクラッカーのバランスが完璧。", author: "sora", postedAt: "2026-06-02T14:20:00Z", upvotes: 61, sourceUrl: "https://example.com/3" },
  { id: "c004", target: "たけのこの里", sentiment: "like", body: "クッキー生地がしっとりしていておいしい。", author: "haru", postedAt: "2026-06-02T15:44:00Z", upvotes: 73, sourceUrl: "https://example.com/4" },
  { id: "c005", target: "納豆", sentiment: "dislike", body: "匂いが部屋に残るのが嫌。", author: "aoi", postedAt: "2026-06-04T07:15:00Z", upvotes: 29, sourceUrl: "https://example.com/5" },
  { id: "c006", target: "パイナップルピザ", sentiment: "dislike", body: "甘いのとしょっぱいのが混ざるのが理解できない。", author: "sora", postedAt: "2026-06-05T20:10:00Z", upvotes: 134, sourceUrl: "https://example.com/6" },
];

export const trades: Row[] = Array.from({ length: 30 }, (_, i) => {
  const day = String(i + 1).padStart(2, "0");
  const pnl = Math.round(Math.sin(i / 3) * 400 + (i - 15) * 12);
  return {
    id: `t${i + 1}`,
    symbol: ["BTC", "ETH", "SOL"][i % 3],
    side: i % 2 ? "long" : "short",
    pnl,
    closedAt: `2026-06-${day}T12:00:00Z`,
  };
});

export const media: Row[] = [
  { id: "m1", title: "Sunset over the bay", cover: "https://picsum.photos/id/10/200/120", category: "photo", link: "https://example.com/m1", views: 1200, published: true },
  { id: "m2", title: "City lights", cover: "https://picsum.photos/id/20/200/120", category: "photo", link: "https://example.com/m2", views: 840, published: false },
  { id: "m3", title: "Mountain trail", cover: "https://picsum.photos/id/30/200/120", category: "video", link: "https://example.com/m3", views: 3300, published: true },
];
