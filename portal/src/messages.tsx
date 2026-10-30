import type { PortalSnapshot } from "../../src/core/portal";
import { Contact, Footer, Header, Layout } from "./pages";

/* Mensajes entre el cliente y tú, en el portal. Sin JavaScript: formularios normales. */

export interface PortalMessage {
  seq: number;
  id: string;
  author: "client" | "admin";
  body: string;
  projectName?: string;
  createdAt: string;
}

const MAX_LENGTH = 4000;

function when(iso: string, tz: string) {
  try {
    return new Intl.DateTimeFormat("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: tz }).format(new Date(iso));
  } catch {
    return iso.slice(0, 16).replace("T", " ");
  }
}

/** "Tú · 28 oct, 20:11 · Proyecto" (también para los mensajes que llegan en vivo). */
export const messageMeta = (m: PortalMessage, snap: PortalSnapshot) =>
  `${m.author === "client" ? "Tú" : snap.brand.name} · ${when(m.createdAt, snap.timeZone)}${m.projectName ? ` · ${m.projectName}` : ""}`;

const lastSeq = (messages: PortalMessage[]) => messages.reduce((n, m) => Math.max(n, m.seq), 0);

function Bubble({ m, snap }: { m: PortalMessage; snap: PortalSnapshot }) {
  return (
    <li class={`msg ${m.author === "client" ? "mine" : "theirs"}`}>
      <p class="msg-meta">{messageMeta(m, snap)}</p>
      <p class="msg-body">{m.body}</p>
    </li>
  );
}

/** Tarjeta en la página principal: últimos mensajes y acceso a la conversación. */
export function MessagesCard({ snap, token, messages }: { snap: PortalSnapshot; token: string; messages: PortalMessage[] }) {
  const last = messages.slice(-3);
  const unanswered = messages.length > 0 && messages[messages.length - 1].author === "admin";
  return (
    <section class="card">
      <div class="row">
        <h2>
          Mensajes
          <span class="count" data-new-reply hidden={!unanswered}>
            Respuesta nueva
          </span>
        </h2>
        <a class="back" href={`/p/${token}/mensajes`}>
          {messages.length ? "Ver todos" : "Escribir"} →
        </a>
      </div>
      <ul class="thread compact" data-live-thread data-after={lastSeq(messages)} data-limit="3" hidden={!last.length}>
        {last.map((m) => (
          <Bubble m={m} snap={snap} />
        ))}
      </ul>
      {!last.length && (
        <p class="muted" data-thread-empty>
          ¿Tienes una duda, un cambio o un comentario sobre el proyecto? Escríbenos aquí y te contestamos en este mismo portal.
        </p>
      )}
    </section>
  );
}

const ERRORS: Record<string, string> = {
  vacio: "Escribe el mensaje.",
  largo: `El mensaje es demasiado largo (máximo ${MAX_LENGTH} caracteres).`,
  limite: "Has enviado muchos mensajes seguidos. Espera un poco y vuelve a intentarlo.",
};

/** Mensajes que se cargan de una vez; los anteriores llegan al subir hasta arriba (portal.js). */
export const MESSAGES_PAGE = 50;

export function MessagesPage({
  snap,
  token,
  messages,
  hasMore,
  error,
  sent,
}: {
  snap: PortalSnapshot;
  token: string;
  messages: PortalMessage[];
  hasMore: boolean;
  error?: string;
  sent?: boolean;
}) {
  const first = messages[0]?.seq ?? 0;
  return (
    <Layout title="Mensajes" brand={snap.brand.name} token={token}>
      <Header snap={snap} token={token} back={`/p/${token}`} backLabel="Volver" />
      <main>
        <section class="card chat" aria-label="Conversación">
          <header class="chat-head">
            <div class="chat-title">
              <h1>Mensajes</h1>
              <p class="muted small">Dudas, cambios o contenidos que faltan: te respondemos aquí.</p>
            </div>
            {snap.projects.length > 0 && (
              <label class="chat-topic">
                <span class="muted small">Sobre</span>
                <select name="projectId" form="composer" aria-label="Sobre qué proyecto">
                  <option value="">General</option>
                  {snap.projects.map((p) => (
                    <option value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>
            )}
          </header>
          {/* column-reverse: la conversación empieza abajo (lo último) incluso sin JavaScript. */}
          <div class="chat-scroll" data-chat-scroll tabindex={0} aria-label="Historial de mensajes">
            <div class="chat-inner">
              {hasMore && (
                <p class="chat-more" data-load-older data-before={first}>
                  <a href={`/p/${token}/mensajes?todos=1`}>Ver mensajes anteriores</a>
                </p>
              )}
              <ul class="thread" data-live-thread data-after={lastSeq(messages)} hidden={!messages.length} aria-live="polite">
                {messages.map((m) => (
                  <Bubble m={m} snap={snap} />
                ))}
              </ul>
              {!messages.length && (
                <p class="chat-empty muted" data-thread-empty>
                  Todavía no hay mensajes. Escribe el primero: te contestaremos en esta misma conversación.
                </p>
              )}
            </div>
          </div>
          <form id="composer" method="post" action={`/p/${token}/mensajes`} class="composer" data-composer>
            {sent && (
              <p class="callout ok composer-note" role="status" data-composer-note>
                Mensaje enviado. Te avisaremos por aquí cuando respondamos.
              </p>
            )}
            {error && ERRORS[error] && (
              <p class="callout err composer-note" role="alert" data-composer-note>
                {ERRORS[error]}
              </p>
            )}
            <div class="composer-row">
              <textarea name="body" required maxlength={MAX_LENGTH} rows={1} placeholder="Escribe un mensaje…" aria-label="Mensaje" />
              <button class="btn primary" type="submit">
                Enviar
              </button>
            </div>
          </form>
        </section>
        <PushCard snap={snap} />
        <Contact snap={snap} />
      </main>
      <Footer snap={snap} token={token} />
    </Layout>
  );
}

/**
 * Notificaciones push. La tarjeta empieza oculta y la muestra portal.js si el
 * navegador las admite (sin JavaScript no se ve). Solo si tu app publicó su clave.
 * - "prompt" (inicio): invita a activarlas hasta que el cliente las activa o las rechaza.
 * - "manage" (Mensajes): estado y botón para activarlas o desactivarlas.
 */
export function PushCard({ snap, mode = "manage" }: { snap: PortalSnapshot; mode?: "prompt" | "manage" }) {
  if (!snap.pushKey) return null;
  return (
    <section class={`card push-card${mode === "prompt" ? " push-prompt" : ""}`} data-push data-key={snap.pushKey} data-mode={mode} hidden aria-live="polite">
      <div class="push-row">
        <span class="push-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
        </span>
        <div class="push-text">
          <h2>Notificaciones</h2>
          <p class="muted small" data-push-status />
        </div>
        <div class="push-actions">
          <button class={mode === "prompt" ? "btn primary" : "btn"} type="button" data-push-toggle hidden />
          {mode === "prompt" && (
            <button class="btn ghost" type="button" data-push-dismiss hidden>
              Ahora no
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export { MAX_LENGTH as MESSAGE_MAX_LENGTH };
