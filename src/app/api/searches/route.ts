import { connection } from "next/server";
import { getStore } from "@/server/registry";
import { handle, readJson } from "@/server/http";
import { resumeInterrupted, startSearch, type StartSearchInput } from "@/server/runner";

export const GET = handle(async () => {
  await connection();
  await resumeInterrupted();
  return Response.json(await getStore().listSearches());
});

export const POST = handle(async (request: Request) => {
  const body = await readJson<Partial<StartSearchInput>>(request);
  try {
    const search = await startSearch({
      name: body.name,
      providerId: String(body.providerId ?? ""),
      queries: Array.isArray(body.queries) ? body.queries.map(String) : [],
      lang: body.lang,
      country: body.country,
      limit: body.limit !== undefined ? Number(body.limit) : undefined,
      options: body.options,
    });
    return Response.json(search, { status: 201 });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 400 });
  }
});
