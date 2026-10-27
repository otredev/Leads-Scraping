import type { HealthStatus } from "./provider";

/**
 * Canales de notificación (push del navegador, y en el futuro Telegram,
 * email, Slack…). Cada canal es un módulo en src/modules/notifiers/ que se
 * registra en src/modules/index.ts. La app les manda mensajes (p. ej. "vence
 * una tarea") sin saber cómo los entrega cada uno.
 */

export interface NotificationMessage {
  title: string;
  body?: string;
  /** Ruta de la app que se abre al pulsar el aviso (p. ej. /leads?lead=…). */
  url?: string;
  /** Agrupa avisos: uno nuevo con la misma etiqueta sustituye al anterior. */
  tag?: string;
}

/** Un destinatario del canal: un navegador, un chat… */
export interface Subscriber {
  id: string;
  /** Nombre legible ("Chrome en Windows"). */
  label: string;
  createdAt: string;
}

export interface SendResult {
  sent: number;
  failed: number;
  /** Suscripciones caducadas que se han borrado. */
  removed: number;
}

/** Lo que la app ofrece a cada canal para guardar sus datos (claves, suscripciones). */
export interface NotifierContext {
  getMeta<T>(key: string): Promise<T | undefined>;
  setMeta(key: string, value: unknown): Promise<void>;
  updateMeta<T>(key: string, fn: (current: T | undefined) => T): Promise<T>;
}

export interface Notifier {
  health(): Promise<HealthStatus>;
  /** Datos públicos que el navegador necesita para suscribirse (p. ej. la clave VAPID). */
  clientConfig(): Promise<Record<string, unknown>>;
  /** Alta de un destinatario. `data` depende del canal (para push, la PushSubscription). */
  subscribe(data: unknown, label: string): Promise<Subscriber>;
  unsubscribe(id: string): Promise<void>;
  listSubscribers(): Promise<Subscriber[]>;
  send(message: NotificationMessage): Promise<SendResult>;
}

export interface NotifierModule {
  id: string;
  label: string;
  description: string;
  create(ctx: NotifierContext): Notifier;
}

export function defineNotifier(m: NotifierModule): NotifierModule {
  return m;
}
