import { connection } from "next/server";
import { computeStats } from "@/core/stats";
import { getStore } from "@/server/registry";
import { handle } from "@/server/http";

export const GET = handle(async () => {
  await connection();
  const store = getStore();
  const [results, saved, settings] = await Promise.all([store.listLeads(), store.listSavedLeads(), store.getSettings()]);

  // Embudo: leads guardados por etapa, en el orden configurado.
  const known = new Set(settings.stages.map((s) => s.id));
  const stages = settings.stages.map((s) => ({ ...s, count: saved.filter((l) => l.stage === s.id).length }));
  const orphans = saved.filter((l) => !known.has(l.stage)).length;
  const last = stages[stages.length - 1];

  return Response.json({
    ...computeStats(results),
    saved: saved.length,
    funnel: {
      stages: orphans ? [{ id: "__none", name: "Sin etapa", color: "gray", count: orphans }, ...stages] : stages,
      total: saved.length,
      contacted: saved.filter((l) => l.lastContactAt).length,
      won: last ? { name: last.name, count: last.count } : undefined,
    },
  });
});
