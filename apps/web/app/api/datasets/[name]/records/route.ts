import { type ExplorerQuery, runQuery } from "@/lib/kiln";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const url = new URL(req.url);
  const project = url.searchParams.get("project") ?? "default";

  let query: ExplorerQuery;
  try {
    const body = (await req.json()) as { query?: ExplorerQuery };
    query = body.query ?? { filters: {}, q: "", page: 1, pageSize: 25 };
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  try {
    const result = await runQuery(name, project, query);
    if (!result) return NextResponse.json({ error: "dataset not found" }, { status: 404 });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
