import type { PortalSnapshot } from "../../src/core/portal";
import { Contact, Footer, Header, Layout } from "./pages";

/* Mensajes entre el cliente y tú, en el portal. Sin JavaScript: formularios normales. */

export interface PortalMessage {
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

function Bubble({ m, snap }: { m: PortalMessage; snap: PortalSnapshot }) {
  const mine = m.author === "client";
  return (
    <li class={`msg ${mine ? "mine" : "theirs"}`}>
      <p class="msg-meta">
        {mine ? "Tú" : snap.brand.name} · {when(m.createdAt, snap.timeZone)}
        {m.projectName ? ` · ${m.projectName}` : ""}
      </p>
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
        <h2>Mensajes {unanswered && <span class="count">Respuesta nueva</span>}</h2>
        <a class="back" href={`/p/${token}/mensajes`}>
          {messages.length ? "Ver todos" : "Escribir"} →
        </a>
      </div>
      {last.length ? (
        <ul class="thread compact">
          {last.map((m) => (
            <Bubble m={m} snap={snap} />
          ))}
        </ul>
      ) : (
        <p class="muted">¿Tienes una duda, un cambio o un comentario sobre el proyecto? Escríbenos aquí y te contestamos en este mismo portal.</p>
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
    <Layout title="Mensajes" brand={snap.brand.name}>
      <Header snap={snap} token={token} back={`/p/${token}`} backLabel="Volver" />
      <main>
        <section class="hero">
          <h1>Mensajes</h1>
          <p class="muted">Escríbenos sobre tus proyectos: dudas, cambios, contenidos que faltan… Te responderemos aquí.</p>
        </section>
        <section class="card">
          {messages.length ? (
            <ul class="thread">
              {messages.map((m) => (
                <Bubble m={m} snap={snap} />
              ))}
            </ul>
          ) : (
            <p class="muted">Todavía no hay mensajes. Escribe el primero.</p>
          )}
        </section>
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

export { MAX_LENGTH as MESSAGE_MAX_LENGTH };
