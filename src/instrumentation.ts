/**
 * Se ejecuta una vez al arrancar el servidor de Next.js.
 * Arranca los recordatorios de tareas (notificaciones push).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.REMINDERS === "off") return;
  const { startReminders } = await import("./server/reminders");
  startReminders();
}
