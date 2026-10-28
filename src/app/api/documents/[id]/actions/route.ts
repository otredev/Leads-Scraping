import { handle, readJson } from "@/server/http";
import { documentAction } from "@/server/documents";

/**
 * { action: "send" | "reopen" | "accept" (name?) | "reject" | "cancel" | "issue" | "paid" (date?, registerPayment?) | "unpaid" }
 */
export const POST = handle(async (request: Request, { params }: RouteContext<"/api/documents/[id]/actions">) =>
  Response.json(await documentAction((await params).id, await readJson(request))),
);
