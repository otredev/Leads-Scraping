import { connection } from "next/server";
import { getStore } from "@/server/registry";
import { resumeInterrupted, startSearch, type StartSearchInput } from "@/server/runner";

export async function GET() {
  await connection();
  await resumeInterrupted();
  return Response.json(await getStore().listSearches());
}

export async function POST(request: Request) {
  let body: Partial<StartSearchInput>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Cuerpo JSON inválido" }, { status: 400 });
  }
  try {
    const search = await startSearch({
      name: body.name,
      providerId: String(body.providerId ?? ""),
      queries: Array.isArray(body.queries) ? body.queries.map(String) : [],
      lang: body.lang,
      limit: body.limit !== undefined ? Number(body.limit) : undefined,
      options: body.options,
    });
    return Response.json(search, { status: 201 });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
}
