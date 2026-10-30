import type { Child } from "hono/jsx";
import type { PortalItem, PortalProject, PortalSnapshot } from "../../src/core/portal";
import { DocumentsList } from "./documents";
import { MessagesCard, PushCard, type PortalMessage } from "./messages";
import { CSS_VERSION } from "./styles";
import { CLIENT_JS_VERSION } from "./client";

// ── Formatos (en la zona horaria de tu app) ──

export const fmt = (tz: string, opts: Intl.DateTimeFormatOptions) => {
  try {
    return new Intl.DateTimeFormat("es", { ...opts, timeZone: tz });
  } catch {
    return new Intl.DateTimeFormat("es", opts);
  }
};
/** "2026-11-30" o ISO → "30 nov 2026" */
export function day(value: string | undefined, tz: string) {
  if (!value) return "";
  const d = value.length === 10 ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return fmt(value.length === 10 ? "UTC" : tz, { day: "numeric", month: "short", year: "numeric" }).format(d);
}
function dateTime(value: string, tz: string) {
  return fmt(tz, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
export function money(amount: number | undefined, currency: string) {
  if (amount === undefined) return "—";
  try {
    return new Intl.NumberFormat("es", { style: "currency", currency, maximumFractionDigits: amount % 1 ? 2 : 0 }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}
/** "AAAA-MM-DD" de una fecha en la zona horaria indicada. */
function ymdOf(date: Date, tz: string) {
  const parts = Object.fromEntries(fmt(tz, { year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
const todayIn = (tz: string) => ymdOf(new Date(), tz);
const ymd = (iso: string, tz: string) => ymdOf(new Date(iso), tz);

function itemState(m: PortalItem, tz: string): "done" | "late" | "open" {
  if (m.done) return "done";
  if (m.dueAt && ymd(m.dueAt, tz) < todayIn(tz)) return "late";
  return "open";
}

function nextMilestone(p: PortalProject) {
  return p.milestones.filter((m) => !m.done && m.dueAt).sort((a, b) => a.dueAt!.localeCompare(b.dueAt!))[0];
}

// ── Piezas ──

export function Layout({ title, children, brand, token }: { title: string; children: Child; brand?: string; token?: string }) {
  return (
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex, nofollow" />
        <meta name="referrer" content="no-referrer" />
        <meta name="color-scheme" content="light dark" />
        <title>{brand ? `${title} · ${brand}` : title}</title>
        <link rel="preload" href="/font.woff2" as="font" type="font/woff2" crossorigin="anonymous" />
        <link rel="stylesheet" href={`/portal.css?v=${CSS_VERSION}`} />
        {token && <link rel="manifest" href={`/p/${token}/manifest.webmanifest`} />}
        <meta name="theme-color" content="#f5f5f5" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0a0a0a" media="(prefers-color-scheme: dark)" />
        <script src={`/portal.js?v=${CLIENT_JS_VERSION}`} defer />
      </head>
      <body>
        <div class="wrap">{children}</div>
      </body>
    </html>
  );
}

/** Marca del portal: lleva siempre a la página principal del cliente. */
export function Brand({ name, token }: { name: string; token?: string }) {
  const inner = (
    <>
      <span class="logo" aria-hidden="true">
        {name.slice(0, 1).toUpperCase()}
      </span>
      {name}
    </>
  );
  return token ? (
    <a class="brand" href={`/p/${token}`} aria-label={`${name}: inicio`}>
      {inner}
    </a>
  ) : (
    <span class="brand">{inner}</span>
  );
}

export function Header({ snap, token, back, backLabel = "Todos los proyectos" }: { snap: PortalSnapshot; token: string; back?: string; backLabel?: string }) {
  return (
    <header class="top">
      <Brand name={snap.brand.name} token={token} />
      {back && (
        <a class="back" href={back}>
          ← {backLabel}
        </a>
      )}
    </header>
  );
}

function Progress({ value, big }: { value: number; big?: boolean }) {
  // <progress> nativo: sin estilos en línea (la CSP del portal no los permite).
  return <progress class={big ? "progress big" : "progress"} value={value} max={100} aria-label={`Avance ${value}%`} />;
}

export function Contact({ snap }: { snap: PortalSnapshot }) {
  const b = snap.brand;
  if (!b.email && !b.phone && !b.whatsapp) return null;
  return (
    <section class="card">
      <h2>¿Dudas o cambios?</h2>
      <p class="muted">Escríbenos y te respondemos lo antes posible.</p>
      <div class="actions">
        {b.whatsapp && (
          <a class="btn primary" href={`https://wa.me/${b.whatsapp}?text=${encodeURIComponent(`Hola, soy ${snap.client.contactName ?? snap.client.name}. `)}`} rel="noopener">
            WhatsApp
          </a>
        )}
        {b.email && (
          <a class="btn" href={`mailto:${b.email}`}>
            {b.email}
          </a>
        )}
        {b.phone && (
          <a class="btn" href={`tel:${b.phone.replace(/\s/g, "")}`}>
            {b.phone}
          </a>
        )}
      </div>
    </section>
  );
}

/** Botón flotante (abajo a la derecha) para ir a Mensajes desde cualquier página del portal. */
export function MessagesFab({ token, alert = false }: { token: string; alert?: boolean }) {
  return (
    <a class="fab" href={`/p/${token}/mensajes`} aria-label={alert ? "Mensajes: tienes una respuesta nueva" : "Mensajes"}>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      </svg>
      <span class="fab-label">Mensajes</span>
      <span class="fab-dot" data-fab-dot hidden={!alert} />
    </a>
  );
}

/** Enlaces a las páginas legales (en el pie). Con token, se abren dentro del portal del cliente. */
export function LegalLinks({ token, current }: { token?: string; current?: string }) {
  const base = token ? `/p/${token}/legal` : "/legal";
  const links = [
    ["aviso-legal", "Aviso legal"],
    ["privacidad", "Privacidad"],
    ["cookies", "Cookies"],
  ];
  return (
    <nav class="legal-links" aria-label="Información legal">
      {links.map(([slug, label]) => (
        <a href={`${base}/${slug}`} aria-current={slug === current ? "page" : undefined}>
          {label}
        </a>
      ))}
    </nav>
  );
}

export function Footer({ snap, token }: { snap: PortalSnapshot; token: string }) {
  return (
    <footer class="foot">
      <p>
        Actualizado el {dateTime(snap.publishedAt, snap.timeZone)}
        {snap.brand.website && (
          <>
            {" · "}
            <a href={snap.brand.website} rel="noopener">
              {snap.brand.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </a>
          </>
        )}
      </p>
      <LegalLinks token={token} />
    </footer>
  );
}

// ── Páginas ──

export function HomePage() {
  return (
    <Layout title="Portal de clientes">
      <main class="center">
        <h1>Portal de clientes</h1>
        <p class="muted">Abre el enlace personal que te hemos enviado para ver el avance de tu proyecto.</p>
      </main>
      <footer class="foot">
        <LegalLinks />
      </footer>
    </Layout>
  );
}

export function NotFoundPage({ error }: { error?: boolean }) {
  return (
    <Layout title={error ? "Error" : "Enlace no válido"}>
      <main class="center">
        <h1>{error ? "Algo ha fallado" : "Este enlace no está disponible"}</h1>
        <p class="muted">
          {error ? "Inténtalo de nuevo en unos minutos." : "Puede que haya caducado o se haya renovado. Pide un enlace nuevo a quien te lo envió."}
        </p>
      </main>
      <footer class="foot">
        <LegalLinks />
      </footer>
    </Layout>
  );
}

export function ProjectsPage({ snap, token, messages }: { snap: PortalSnapshot; token: string; messages: PortalMessage[] }) {
  const tz = snap.timeZone;
  const name = snap.client.contactName ?? snap.client.name;
  return (
    <Layout title={snap.client.name} brand={snap.brand.name} token={token}>
      <Header snap={snap} token={token} />
      <main>
        <section class="hero">
          <h1>Hola, {name}</h1>
          <p class="muted">{snap.brand.welcome ?? "Aquí puedes seguir el avance de tus proyectos, las próximas entregas y lo que queda pendiente."}</p>
        </section>
        {snap.projects.length === 0 ? (
          <section class="card">
            <p class="muted">Todavía no hay proyectos publicados.</p>
          </section>
        ) : (
          <ul class="projects">
            {snap.projects.map((p) => {
              const next = nextMilestone(p);
              const pending = p.tasks.filter((t) => !t.done).length;
              return (
                <li>
                  <a class="card project" href={`/p/${token}/${p.id}`}>
                    <div class="row">
                      <h2>{p.name}</h2>
                      <span class={`pill s-${p.status}`}>{p.statusLabel}</span>
                    </div>
                    <div class="row">
                      <Progress value={p.progress} />
                      <span class="pct">{p.progress}%</span>
                    </div>
                    <p class="muted small">
                      {next
                        ? `Próximo: ${next.title} · ${day(next.dueAt, tz)}`
                        : p.dueDate
                          ? `Entrega prevista: ${day(p.dueDate, tz)}`
                          : "Sin fechas previstas"}
                      {pending ? ` · ${pending} ${pending === 1 ? "tarea pendiente" : "tareas pendientes"}` : ""}
                    </p>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
        <PushCard snap={snap} mode="prompt" />
        <MessagesCard snap={snap} token={token} messages={messages} />
        <DocumentsList snap={snap} token={token} />
        <Contact snap={snap} />
      </main>
      <Footer snap={snap} token={token} />
      <MessagesFab token={token} alert={messages.length > 0 && messages[messages.length - 1].author === "admin"} />
    </Layout>
  );
}

function ItemList({ items, tz, empty }: { items: PortalItem[]; tz: string; empty: string }) {
  if (!items.length) return <p class="muted">{empty}</p>;
  return (
    <ul class="items">
      {items.map((t) => {
        const s = itemState(t, tz);
        return (
          <li class={`item ${s}`}>
            <span class="check" aria-hidden="true">
              {s === "done" ? "✓" : ""}
            </span>
            <span>
              <span class="title">{t.title}</span>
              <span class="small muted">
                {s === "done"
                  ? `Hecho${t.doneAt ? ` el ${day(t.doneAt, tz)}` : ""}`
                  : s === "late"
                    ? `Previsto el ${day(t.dueAt, tz)} · con retraso`
                    : t.dueAt
                      ? `Previsto el ${day(t.dueAt, tz)}`
                      : "Sin fecha"}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function ProjectPage({ snap, project: p, token }: { snap: PortalSnapshot; project: PortalProject; token: string }) {
  const tz = snap.timeZone;
  const next = nextMilestone(p);
  const milestones = [...p.milestones].sort((a, b) => (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999"));
  const pending = p.tasks.filter((t) => !t.done).sort((a, b) => (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999"));
  const done = p.tasks.filter((t) => t.done).sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? ""));
  const backHref = snap.projects.length > 1 ? `/p/${token}` : undefined;

  return (
    <Layout title={p.name} brand={snap.brand.name} token={token}>
      <Header snap={snap} token={token} back={backHref} />
      <main>
        <section class="card">
          <div class="row">
            <h1>{p.name}</h1>
            <span class={`pill s-${p.status}`}>{p.statusLabel}</span>
          </div>
          <p class="muted small">
            {[p.startDate && `Inicio ${day(p.startDate, tz)}`, p.dueDate && `Entrega prevista ${day(p.dueDate, tz)}`].filter(Boolean).join(" · ") || "Sin fechas previstas"}
          </p>
          <div class="row big-progress">
            <Progress value={p.progress} big />
            <strong class="pct">{p.progress}%</strong>
          </div>
          {next && (
            <p class="callout">
              <strong>Próxima entrega:</strong> {next.title} · {day(next.dueAt, tz)}
            </p>
          )}
          {p.description && <p class="desc">{p.description}</p>}
        </section>

        {milestones.length > 0 && (
          <section class="card">
            <h2>Cronograma</h2>
            <ol class="timeline">
              {milestones.map((m) => {
                const s = itemState(m, tz);
                return (
                  <li class={s}>
                    <span class="dot" aria-hidden="true">
                      {s === "done" ? "✓" : ""}
                    </span>
                    <span class="title">{m.title}</span>
                    <span class="small muted">
                      {s === "done"
                        ? `Completado${m.doneAt ? ` el ${day(m.doneAt, tz)}` : ""}`
                        : s === "late"
                          ? `Previsto el ${day(m.dueAt, tz)} · con retraso`
                          : m.dueAt
                            ? `Previsto el ${day(m.dueAt, tz)}`
                            : "Fecha por confirmar"}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        <section class="card">
          <h2>Pendiente {pending.length > 0 && <span class="count">{pending.length}</span>}</h2>
          <ItemList items={pending} tz={tz} empty="No hay tareas pendientes." />
          {done.length > 0 && (
            <details>
              <summary>Completadas ({done.length})</summary>
              <ItemList items={done} tz={tz} empty="" />
            </details>
          )}
        </section>

        {p.money && (
          <section class="card">
            <h2>Presupuesto y pagos</h2>
            <dl class="money">
              <div>
                <dt>Presupuesto</dt>
                <dd>{money(p.money.budget, p.money.currency)}</dd>
              </div>
              <div>
                <dt>Pagado</dt>
                <dd>{money(p.money.paid, p.money.currency)}</dd>
              </div>
              <div>
                <dt>Pendiente</dt>
                <dd>{money(p.money.pending, p.money.currency)}</dd>
              </div>
            </dl>
            {p.money.payments.length > 0 && (
              <ul class="payments">
                {p.money.payments.map((x) => (
                  <li>
                    <span class="small muted">{day(x.date, tz)}</span>
                    <span>{x.note ?? "Pago"}</span>
                    <strong>{money(x.amount, p.money!.currency)}</strong>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <Contact snap={snap} />
      </main>
      <Footer snap={snap} token={token} />
      <MessagesFab token={token} />
    </Layout>
  );
}
