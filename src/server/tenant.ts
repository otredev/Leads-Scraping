import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Cuenta en cuyo nombre se ejecuta el código (cada usuario tiene sus propios datos).
 *
 * Cada petición autenticada corre dentro de runAsTenant(); getStore() y el resto
 * del servidor leen de aquí qué datos usar, sin tener que pasarlo a mano. Los
 * temporizadores y tareas en segundo plano creados dentro heredan la cuenta.
 */
export interface Tenant {
  userId: string;
  /**
   * Dónde viven sus datos: "" para la primera cuenta (los datos que ya había
   * antes de añadir el inicio de sesión) y "u_<id>" para las demás.
   */
  dataKey: string;
}

const g = globalThis as unknown as { __tenantContext?: AsyncLocalStorage<Tenant> };
// En globalThis: Next.js puede cargar este módulo en varios paquetes y todos deben compartirlo.
const context = (g.__tenantContext ??= new AsyncLocalStorage<Tenant>());

export function runAsTenant<T>(tenant: Tenant, fn: () => T): T {
  return context.run(tenant, fn);
}

/** Cuenta actual, o undefined fuera de una petición autenticada. */
export function maybeTenant(): Tenant | undefined {
  return context.getStore();
}

/** Cuenta actual. Fuera de una petición autenticada es un error de programación (o falta iniciar sesión). */
export function currentTenant(): Tenant {
  const t = context.getStore();
  if (!t) throw Object.assign(new Error("Inicia sesión para continuar"), { status: 401 });
  return t;
}

/** Clave para cachés y contadores que deben ir por cuenta. */
export const tenantKey = () => currentTenant().dataKey || "root";
