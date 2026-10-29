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

export function MessagesPage({ snap, token, messages, error, sent }: { snap: PortalSnapshot; token: string; messages: PortalMessage[]; error?: string; sent?: boolean }) {
  return (
    <Layout title="Mensajes" brand={snap.brand.name} token={token}>
      <Header snap={snap} token={token} back={`/p/${token}`} backLabel="Volver" />
      <main>
        <section class="hero">
          <h1>Mensajes</h1>
          <p class="muted">Escríbenos sobre tus proyectos: dudas, cambios, contenidos que faltan… Te responderemos aquí.</p>
        </section>
        <section class="card">
          <ul class="thread" data-live-thread data-after={lastSeq(messages)} hidden={!messages.length}>
            {messages.map((m) => (
              <Bubble m={m} snap={snap} />
            ))}
          </ul>
          {!messages.length && (
            <p class="muted" data-thread-empty>
              Todavía no hay mensajes. Escribe el primero.
            </p>
          )}
        </section>
        <PushCard snap={snap} />
        <section class="card" id="escribir">
          <h2>Nuevo mensaje</h2>
          {sent && (
            <p class="callout ok" role="status">
              Mensaje enviado. Te avisaremos por aquí cuando respondamos.
            </p>
          )}
          {error && ERRORS[error] && (
            <p class="callout err" role="alert">
              {ERRORS[error]}
            </p>
          )}
          <form method="post" action={`/p/${token}/mensajes`} class="accept">
            {snap.projects.length > 0 && (
              <label>
                <span>Sobre</span>
                <select name="projectId">
                  <option value="">General</option>
                  {snap.projects.map((p) => (
                    <option value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>
            )}
            <label>
              <span>Mensaje</span>
              <textarea name="body" required maxlength={MAX_LENGTH} rows={5} />
            </label>
            <button class="btn primary" type="submit">
              Enviar mensaje
            </button>
          </form>
        </section>
        <Contact snap={snap} />
      </main>
      <Footer snap={snap} token={token} />
    </Layout>
  );
}

/**
 * Avisos push: la tarjeta empieza oculta y la muestra portal.js si el navegador
 * los admite (sin JavaScript no se ve). Solo si tu app publicó su clave.
 */
export function PushCard({ snap }: { snap: PortalSnapshot }) {
  if (!snap.pushKey) return null;
  return (
    <section class="card push-card" data-push data-key={snap.pushKey} hidden>
      <div class="push-row">
        <div class="push-text">
          <h2>Avisos</h2>
          <p class="muted small" data-push-status />
        </div>
        <button class="btn" type="button" data-push-toggle hidden />
      </div>
    </section>
  );
}

export { MAX_LENGTH as MESSAGE_MAX_LENGTH };
