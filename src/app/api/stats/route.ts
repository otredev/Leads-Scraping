import { connection } from "next/server";
import { getStats } from "@/server/stats";
import { handle } from "@/server/http";

export const GET = handle(async () => {
  await connection();
  return Response.json(await getStats());
});
