import { connection } from "next/server";
import { computeStats } from "@/core/stats";
import { getStore } from "@/server/registry";
import { handle } from "@/server/http";

export const GET = handle(async () => {
  await connection();
  const store = getStore();
  const [results, saved] = await Promise.all([store.listLeads(), store.savedKeys()]);
  return Response.json({ ...computeStats(results), saved: saved.length });
});
