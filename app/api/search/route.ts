import { NextRequest } from "next/server";
import { searchWeb } from "@/lib/tools/researcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!q.trim()) {
    return Response.json({ error: "query manquante" }, { status: 400 });
  }
  try {
    const results = await searchWeb(q, 8);
    return Response.json({ results });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
