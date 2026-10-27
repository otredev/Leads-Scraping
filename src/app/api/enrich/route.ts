import { connection } from "next/server";
import { handle, idsFrom, readJson } from "@/server/http";
import { enrichers } from "@/server/registry";
import { startEnrichment, waitForJob } from "@/server/enrich";

/** Enriquecedores disponibles. */
export const GET = handle(async () => {
  await connection();
  const list = await Promise.all(
    enrichers.map(async (e) => ({
      id: e.id,
      label: e.label,
      description: e.description,
      provides: e.provides,
      requirement: e.requirement,
      health: await e.health().catch((err: Error) => ({ ok: false, message: err.message })),
    })),
  );
  return Response.json({ enrichers: list });
});

/**
 * Completa datos de leads guardados: { ids, enrichers?, wait? }.
 * Con wait (hasta 5 leads) espera al resultado; si no, devuelve el trabajo y se consulta en /api/enrich/<id>.
 */
export const POST = handle(async (request: Request) => {
  const body = await readJson<{ ids?: string[]; enrichers?: string[]; wait?: boolean }>(request);
  const job = await startEnrichment(idsFrom(body), Array.isArray(body.enrichers) ? body.enrichers.map(String) : undefined);
  if (body.wait && job.total <= 5) return Response.json(await waitForJob(job.id));
  return Response.json(job, { status: 202 });
});
