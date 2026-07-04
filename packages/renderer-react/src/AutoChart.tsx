import type { ChartCandidate } from "@kiln/ui-planner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell as PieCell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Row } from "./AutoTable.js";
import { formatDate } from "./format.js";

export interface AutoChartProps {
  candidate: ChartCandidate;
  rows: Row[];
  height?: number;
}

const PALETTE = [
  "#0ea5e9",
  "#6366f1",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
];

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function aggregateBy(rows: Row[], key: string, value: string): { name: string; value: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = String(r[key] ?? "—");
    map.set(k, (map.get(k) ?? 0) + num(r[value]));
  }
  return [...map.entries()].map(([name, v]) => ({ name, value: v }));
}

function countBy(rows: Row[], key: string): { name: string; value: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = String(r[key] ?? "—");
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()].map(([name, v]) => ({ name, value: v }));
}

function timeSeries(rows: Row[], x: string, y: string): { name: string; value: number }[] {
  return rows
    .map((r) => ({ t: String(r[x] ?? ""), value: num(r[y]) }))
    .filter((d) => d.t)
    .sort((a, b) => a.t.localeCompare(b.t))
    .map((d) => ({ name: formatDate(d.t), value: d.value }));
}

/** Render one chart candidate from the {@link UIPlan}. */
export function AutoChart({ candidate, rows, height = 260 }: AutoChartProps) {
  const isCount = candidate.y === "__count__";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/40">
      <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
        {candidate.label}
      </h3>
      <ResponsiveContainer width="100%" height={height}>
        {candidate.kind === "line" ? (
          <LineChart data={timeSeries(rows, candidate.x, candidate.y)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" fontSize={11} />
            <YAxis fontSize={11} />
            <Tooltip />
            <Line type="monotone" dataKey="value" stroke={PALETTE[0]} strokeWidth={2} dot={false} />
          </LineChart>
        ) : candidate.kind === "bar" ? (
          <BarChart data={aggregateBy(rows, candidate.x, candidate.y)}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" fontSize={11} />
            <YAxis fontSize={11} />
            <Tooltip />
            <Bar dataKey="value" fill={PALETTE[1]} radius={[4, 4, 0, 0]} />
          </BarChart>
        ) : (
          <PieChart>
            <Pie
              data={isCount ? countBy(rows, candidate.x) : aggregateBy(rows, candidate.x, candidate.y)}
              dataKey="value"
              nameKey="name"
              outerRadius={90}
              label
            >
              {(isCount ? countBy(rows, candidate.x) : aggregateBy(rows, candidate.x, candidate.y)).map(
                (_, i) => (
                  <PieCell key={i} fill={PALETTE[i % PALETTE.length]} />
                ),
              )}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
