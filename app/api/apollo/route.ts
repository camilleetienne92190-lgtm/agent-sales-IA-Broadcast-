import { NextRequest } from "next/server";
import { searchPeople, DEFAULT_DECISION_MAKER_TITLES } from "@/lib/tools/apollo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { company?: string } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ contacts: [], error: "Body JSON invalide." }, { status: 400 });
  }
  const company = (body.company ?? "").trim();
  if (!company) {
    return Response.json({ contacts: [], error: "company manquante" }, { status: 400 });
  }
  try {
    const contacts = await searchPeople(company, DEFAULT_DECISION_MAKER_TITLES);
    return Response.json({ contacts });
  } catch (e) {
    return Response.json(
      { contacts: [], error: (e as Error).message },
      { status: 200 },
    );
  }
}
