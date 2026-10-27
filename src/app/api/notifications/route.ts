import { connection } from "next/server";
import { handle } from "@/server/http";
import { getNotifier, notifiers } from "@/server/notifications";

/** Canales de notificación, su estado y sus destinatarios. */
export const GET = handle(async () => {
  await connection();
  const channels = await Promise.all(
    notifiers.map(async (m) => {
      const { notifier } = getNotifier(m.id)!;
      const [health, config, subscribers] = await Promise.all([
        notifier.health(),
        notifier.clientConfig().catch(() => ({})),
        notifier.listSubscribers().catch(() => []),
      ]);
      return { id: m.id, label: m.label, description: m.description, health, config, subscribers };
    }),
  );
  return Response.json({ channels });
});
