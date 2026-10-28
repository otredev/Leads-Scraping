/**
 * Mensajes con los clientes (desde su portal) y notas internas.
 *
 * Los mensajes del cliente y tus respuestas viven en el portal (D1) y la app
 * guarda una copia; las notas internas ("note") solo existen en la app.
 */

export type MessageAuthor = "client" | "admin" | "note";

export interface Message {
  id: string;
  clientId: string;
  author: MessageAuthor;
  body: string;
  projectId?: string;
  projectName?: string;
  createdAt: string;
  /** Orden en el portal (cursor de sincronización). Las notas no tienen. */
  seq?: number;
  /** Mensajes del cliente: cuándo lo leíste. */
  readAt?: string;
}

/** Aceptación de las políticas del portal (aviso legal y privacidad). */
export interface PortalConsent {
  /** Versión de los textos legales aceptados. */
  version: string;
  name: string;
  at: string;
  ip?: string;
  userAgent?: string;
}

export interface Conversation {
  clientId: string;
  clientName: string;
  last?: Pick<Message, "author" | "body" | "createdAt">;
  unread: number;
  portalEnabled: boolean;
}
