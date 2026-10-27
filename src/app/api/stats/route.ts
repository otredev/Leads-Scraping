import { connection } from "next/server";
import { computeStats } from "@/core/stats";
import { getStore } from "@/server/registry";

export async function GET() {
  await connection();
  return Response.json(computeStats(await getStore().listLeads()));
}
