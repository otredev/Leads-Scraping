/**
 * Portal del cliente (Cloudflare Workers + D1).
 *
 * - /p/<token>            proyectos del cliente
 * - /p/<token>/<proyecto> avance, cronograma, tareas y pagos de un proyecto
 * - /p/<token>/d/<doc>    propuesta, contrato o factura (y aceptarla)
 * - /p/<token>/mensajes   mensajes entre el cliente y tú
 * - /p/<token>/legal/<p>  páginas legales dentro del portal
 *
 * Antes de ver nada, el cliente acepta el aviso legal y la privacidad (tabla consents).
 * Con portal.js, los mensajes se actualizan solos y el cliente puede activar avisos
 * push (los envía tu app con su clave VAPID; aquí solo se guardan las suscripciones).
 * - /legal/<página>      aviso legal, privacidad y cookies (con tus datos de Ajustes)
 * - /api/*                API privada para que tu app publique (Bearer PORTAL_SECRET)
 *
 * El portal no conoce tu CRM: solo guarda el último snapshot que publica tu app.
 */
import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { bodyLimit } from "hono/body-limit";
import type { Context } from "hono";
import type { PortalSite, PortalSnapshot } from "../../src/core/portal";
import { CSS, CSS_VERSION } from "./styles";
import { FONT_WOFF2 } from "./font";
import { CLIENT_JS, CLIENT_JS_VERSION, SERVICE_WORKER_JS } from "./client";
import { HomePage, NotFoundPage, ProjectPage, ProjectsPage } from "./pages";
import { DocumentPage } from "./documents";
import { LEGAL_PAGES, LegalPage, policyVersion, type LegalSlug } from "./legal";
import { ConsentPage } from "./consent";
import { MESSAGE_MAX_LENGTH, MessagesPage, messageMeta, type PortalMessage } from "./messages";

type Env = { DB: D1Database; PORTAL_SECRET: string };

const app = new Hono<{ Bindings: Env }>();

// El token va en la URL: no debe filtrarse por Referer ni indexarse.
app.use(
  "*",
  secureHeaders({
    referrerPolicy: "no-referrer",
    xFrameOptions: "DENY",
    contentSecurityPolicy: {
      defaultSrc: ["'none'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      fontSrc: ["'self'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      workerSrc: ["'self'"],
      manifestSrc: ["'self'"],
      baseUri: ["'none'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
    },
  }),
);
app.use("*", async (c, next) => {
  await next();
  c.header("X-Robots-Tag", "noindex, nofollow");
});

app.get("/robots.txt", (c) => c.text("User-agent: *\nDisallow: /\n"));
// La hoja lleva ?v=<huella>: al cambiar los estilos, el navegador pide la nueva en vez de usar la guardada.
app.get("/portal.css", (c) => {
  c.header("Cache-Control", c.req.query("v") === CSS_VERSION ? "public, max-age=31536000, immutable" : "no-cache");
  return c.body(CSS, 200, { "Content-Type": "text/css; charset=utf-8" });
});
app.get("/portal.js", (c) => {
  c.header("Cache-Control", c.req.query("v") === CLIENT_JS_VERSION ? "public, max-age=31536000, immutable" : "no-cache");
  return c.body(CLIENT_JS, 200, { "Content-Type": "text/javascript; charset=utf-8" });
});
// Sin caché: así el navegador recoge siempre la última versión del service worker.
app.get("/sw.js", (c) => c.body(SERVICE_WORKER_JS, 200, { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-cache" }));
const fontBytes = Uint8Array.from(atob(FONT_WOFF2), (ch) => ch.charCodeAt(0));
app.get("/font.woff2", (c) => {
  c.header("Cache-Control", "public, max-age=31536000, immutable");
  return c.body(fontBytes, 200, { "Content-Type": "font/woff2" });
});
app.get("/", (c) => c.html(<HomePage />));

// ── Páginas legales (públicas) ──

async function loadSite(db: D1Database) {
  const row = await db.prepare("SELECT value FROM site WHERE key = 'site'").first<{ value: string }>();
  return row ? (JSON.parse(row.value) as PortalSite) : undefined;
}

app.get("/legal/:page", async (c) => {
  const page = c.req.param("page") as LegalSlug;
  if (!Object.hasOwn(LEGAL_PAGES, page)) return c.html(<NotFoundPage />, 404);
  c.header("Cache-Control", "public, max-age=300");
  return c.html(<LegalPage page={page} site={await loadSite(c.env.DB)} />);
});

// ── Páginas del cliente ──

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function loadPortal(c: { env: Env; executionCtx: { waitUntil(p: Promise<unknown>): void } }, token: string, { countVisit = true } = {}) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return undefined;
  const hash = await sha256(token);
  const row = await c.env.DB.prepare("SELECT client_id, snapshot FROM portals WHERE token_hash = ?").bind(hash).first<{ client_id: string; snapshot: string }>();
  if (!row) return undefined;
  // Registrar la visita sin retrasar la respuesta.
  if (countVisit)
    c.executionCtx.waitUntil(
      c.env.DB.prepare("UPDATE portals SET last_viewed_at = ?, views = views + 1 WHERE client_id = ?").bind(new Date().toISOString(), row.client_id).run(),
    );
  return JSON.parse(row.snapshot) as PortalSnapshot;
}

/** Aceptación guardada en el portal (aún no reflejada en el snapshot si tu app no lo ha recogido). */
async function findAcceptance(db: D1Database, clientId: string, docId: string, sentAt: string) {
  return db
    .prepare("SELECT name, accepted_at FROM acceptances WHERE client_id = ? AND doc_id = ? AND sent_at = ?")
    .bind(clientId, docId, sentAt)
    .first<{ name: string; accepted_at: string }>();
}

app.use("/p/*", async (c, next) => {
  await next();
  c.header("Cache-Control", "private, no-store");
});

type Ctx = Context<{ Bindings: Env }>;

/**
 * Solo formularios enviados desde el propio portal. Los navegadores mandan
 * Sec-Fetch-Site siempre; Origin llega como "null" por la política no-referrer,
 * así que solo se usa si falta Sec-Fetch-Site (navegadores antiguos). Además,
 * sin el token del enlace no se puede enviar nada.
 */
const sameOrigin = (c: Ctx) => {
  const site = c.req.header("sec-fetch-site");
  if (site) return site === "same-origin";
  const origin = c.req.header("origin");
  return !origin || origin === "null" || origin === new URL(c.req.url).origin;
};
const clientIp = (c: Ctx) => c.req.header("cf-connecting-ip") ?? null;
const clientUa = (c: Ctx) => (c.req.header("user-agent") ?? "").slice(0, 300) || null;
const cleanName = (v: unknown) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, 120) : "");

/** ¿Aceptó este cliente la versión actual de las políticas? */
async function consentState(c: Ctx, clientId: string) {
  const version = await policyVersion(await loadSite(c.env.DB));
  const rows = await c.env.DB.prepare("SELECT version FROM consents WHERE client_id = ?").bind(clientId).all<{ version: string }>();
  return { version, ok: rows.results.some((r) => r.version === version), updated: rows.results.length > 0 };
}

/**
 * Carga el portal y exige la aceptación de las políticas: si falta, muestra la
 * página de aceptación en la misma dirección (después vuelve aquí).
 */
async function gate(c: Ctx, render: (snap: PortalSnapshot, token: string) => Response | Promise<Response>) {
  const token = c.req.param("token")!;
  const snap = await loadPortal(c, token);
  if (!snap) return c.html(<NotFoundPage />, 404);
  const consent = await consentState(c, snap.client.id);
  if (!consent.ok) return c.html(<ConsentPage snap={snap} token={token} next={new URL(c.req.url).pathname} updated={consent.updated} error={c.req.query("consent")} />);
  return render(snap, token);
}

async function loadMessages(db: D1Database, clientId: string): Promise<PortalMessage[]> {
  const { results } = await db
    .prepare("SELECT seq, id, author, body, project_name, created_at FROM messages WHERE client_id = ? ORDER BY seq DESC LIMIT 200")
    .bind(clientId)
    .all<{ seq: number; id: string; author: "client" | "admin"; body: string; project_name: string | null; created_at: string }>();
  return results.reverse().map((r) => ({ seq: r.seq, id: r.id, author: r.author, body: r.body, createdAt: r.created_at, ...(r.project_name ? { projectName: r.project_name } : {}) }));
}

app.get("/p/:token", (c) => gate(c, async (snap, token) => c.html(<ProjectsPage snap={snap} token={token} messages={await loadMessages(c.env.DB, snap.client.id)} />)));

/** Aceptación de las políticas. */
app.post("/p/:token/consent", bodyLimit({ maxSize: 8 * 1024 }), async (c) => {
  const token = c.req.param("token");
  if (!sameOrigin(c)) return c.text("Origen no permitido", 403);
  const snap = await loadPortal(c, token, { countVisit: false });
  if (!snap) return c.html(<NotFoundPage />, 404);
  const form = await c.req.parseBody();
  const next = typeof form.next === "string" && form.next.startsWith(`/p/${token}`) ? form.next : `/p/${token}`;
  // Sin pedir el nombre: el enlace es personal, así que se registra a nombre del contacto del cliente.
  const name = cleanName(snap.client.contactName ?? snap.client.name) || snap.client.name;
  const back = (q: string) => c.redirect(`${next}?consent=${q}`, 303);
  if (form.agree !== "1") return back("casilla");
  const { version } = await consentState(c, snap.client.id);
  await c.env.DB.prepare("INSERT OR IGNORE INTO consents (client_id, version, name, accepted_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(snap.client.id, version, name, new Date().toISOString(), clientIp(c), clientUa(c))
    .run();
  return c.redirect(next, 303);
});

/** Páginas legales dentro del portal (sin pedir la aceptación: hay que poder leerlas antes). */
app.get("/p/:token/legal/:page", async (c) => {
  const token = c.req.param("token");
  const page = c.req.param("page") as LegalSlug;
  const snap = await loadPortal(c, token, { countVisit: false });
  if (!snap || !Object.hasOwn(LEGAL_PAGES, page)) return c.html(<NotFoundPage />, 404);
  return c.html(<LegalPage page={page} site={await loadSite(c.env.DB)} token={token} />);
});

app.get("/p/:token/mensajes", (c) =>
  gate(c, async (snap, token) => {
    // Para el "Visto" de tu app.
    c.executionCtx.waitUntil(
      c.env.DB.prepare("INSERT INTO message_seen (client_id, seen_at) VALUES (?1, ?2) ON CONFLICT(client_id) DO UPDATE SET seen_at = ?2")
        .bind(snap.client.id, new Date().toISOString())
        .run(),
    );
    return c.html(<MessagesPage snap={snap} token={token} messages={await loadMessages(c.env.DB, snap.client.id)} error={c.req.query("error")} sent={c.req.query("ok") === "1"} />);
  }),
);

app.post("/p/:token/mensajes", bodyLimit({ maxSize: 16 * 1024 }), (c) => {
  if (!sameOrigin(c)) return c.text("Origen no permitido", 403);
  return gate(c, async (snap, token) => {
    const back = (q: string) => c.redirect(`/p/${token}/mensajes?${q}#escribir`, 303);
    const form = await c.req.parseBody();
    const body = typeof form.body === "string" ? form.body.replace(/\r\n/g, "\n").trim() : "";
    if (!body) return back("error=vacio");
    if (body.length > MESSAGE_MAX_LENGTH) return back("error=largo");
    const recent = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM messages WHERE client_id = ? AND author = 'client' AND created_at > ?")
      .bind(snap.client.id, new Date(Date.now() - 3600_000).toISOString())
      .first<{ n: number }>();
    if ((recent?.n ?? 0) >= 30) return back("error=limite");
    const project = typeof form.projectId === "string" ? snap.projects.find((p) => p.id === form.projectId) : undefined;
    await c.env.DB.prepare("INSERT INTO messages (id, client_id, author, body, project_id, project_name, created_at) VALUES (?, ?, 'client', ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), snap.client.id, body, project?.id ?? null, project?.name ?? null, new Date().toISOString())
      .run();
    return back("ok=1");
  });
});

// ── Mensajes en vivo y avisos push (los usa portal.js) ──

/** Igual que gate(), pero para las peticiones de portal.js: responde JSON. */
async function gateJson(c: Ctx, run: (snap: PortalSnapshot) => Response | Promise<Response>) {
  const snap = await loadPortal(c, c.req.param("token")!, { countVisit: false });
  if (!snap) return c.json({ error: "No disponible" }, 404);
  if (!(await consentState(c, snap.client.id)).ok) return c.json({ error: "Falta aceptar las condiciones" }, 403);
  return run(snap);
}

/** Mensajes con seq > after, con su línea de autor y hora ya formateada. */
app.get("/p/:token/mensajes.json", (c) =>
  gateJson(c, async (snap) => {
    const after = Number(c.req.query("after") ?? 0) || 0;
    const { results } = await c.env.DB.prepare(
      "SELECT seq, id, author, body, project_name, created_at FROM messages WHERE client_id = ? AND seq > ? ORDER BY seq LIMIT 100",
    )
      .bind(snap.client.id, after)
      .all<{ seq: number; id: string; author: "client" | "admin"; body: string; project_name: string | null; created_at: string }>();
    const messages: PortalMessage[] = results.map((r) => ({ seq: r.seq, id: r.id, author: r.author, body: r.body, createdAt: r.created_at, ...(r.project_name ? { projectName: r.project_name } : {}) }));
    // Si le llega una respuesta tuya con la página abierta, cuenta como vista.
    if (messages.some((m) => m.author === "admin"))
      c.executionCtx.waitUntil(
        c.env.DB.prepare("INSERT INTO message_seen (client_id, seen_at) VALUES (?1, ?2) ON CONFLICT(client_id) DO UPDATE SET seen_at = ?2")
          .bind(snap.client.id, new Date().toISOString())
          .run(),
      );
    return c.json({ messages: messages.map((m) => ({ seq: m.seq, author: m.author, body: m.body, meta: messageMeta(m, snap) })) });
  }),
);

/** Activa ({ endpoint, keys }) o desactiva ({ endpoint, remove: true }) los avisos en un dispositivo. */
app.post("/p/:token/push", bodyLimit({ maxSize: 8 * 1024 }), (c) => {
  if (!sameOrigin(c)) return c.json({ error: "Origen no permitido" }, 403);
  return gateJson(c, async (snap) => {
    const body = await c.req.json<{ endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown }; remove?: unknown }>().catch(() => undefined);
    const endpoint = typeof body?.endpoint === "string" && /^https:\/\/[^\s]{10,1000}$/.test(body.endpoint) ? body.endpoint : undefined;
    if (!endpoint) return c.json({ error: "Suscripción no válida" }, 400);
    if (body!.remove === true) {
      await c.env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ? AND client_id = ?").bind(endpoint, snap.client.id).run();
      return c.json({ ok: true });
    }
    const key = (v: unknown) => (typeof v === "string" && /^[A-Za-z0-9_=-]{16,200}$/.test(v) ? v : undefined);
    const p256dh = key(body!.keys?.p256dh);
    const auth = key(body!.keys?.auth);
    if (!p256dh || !auth) return c.json({ error: "Suscripción no válida" }, 400);
    const count = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM push_subscriptions WHERE client_id = ? AND endpoint != ?").bind(snap.client.id, endpoint).first<{ n: number }>();
    if ((count?.n ?? 0) >= 20) return c.json({ error: "Demasiados dispositivos" }, 429);
    await c.env.DB.prepare(
      `INSERT INTO push_subscriptions (endpoint, client_id, p256dh, auth, user_agent, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
       ON CONFLICT(endpoint) DO UPDATE SET client_id = ?2, p256dh = ?3, auth = ?4, user_agent = ?5`,
    )
      .bind(endpoint, snap.client.id, p256dh, auth, clientUa(c), new Date().toISOString())
      .run();
    return c.json({ ok: true });
  });
});

/** Para instalarlo en la pantalla de inicio (en iPhone es necesario para recibir avisos). */
app.get("/p/:token/manifest.webmanifest", async (c) => {
  const token = c.req.param("token");
  const snap = await loadPortal(c, token, { countVisit: false });
  if (!snap) return c.json({ error: "No disponible" }, 404);
  return c.json(
    {
      name: `${snap.brand.name} · Portal de clientes`,
      short_name: snap.brand.name.slice(0, 24),
      start_url: `/p/${token}`,
      scope: `/p/${token}`,
      display: "standalone",
      background_color: "#f5f5f5",
      theme_color: "#f5f5f5",
      lang: "es",
    },
    200,
    { "Content-Type": "application/manifest+json" },
  );
});

app.get("/p/:token/d/:docId", (c) =>
  gate(c, async (snap, token) => {
    const doc = snap.documents?.find((d) => d.id === c.req.param("docId"));
    if (!doc) return c.html(<NotFoundPage />, 404);
    const stored = doc.acceptable ? await findAcceptance(c.env.DB, snap.client.id, doc.id, doc.acceptable.sentAt) : null;
    const acceptance = doc.acceptance ?? (stored ? { name: stored.name, at: stored.accepted_at } : undefined);
    return c.html(<DocumentPage snap={snap} doc={doc} token={token} acceptance={acceptance} error={c.req.query("error")} />);
  }),
);

/** El cliente acepta una propuesta o firma un contrato: nombre + casilla. */
app.post("/p/:token/d/:docId/accept", bodyLimit({ maxSize: 8 * 1024 }), (c) => {
  if (!sameOrigin(c)) return c.text("Origen no permitido", 403);
  return gate(c, async (snap, token) => {
    const docId = c.req.param("docId");
    const back = (q = "") => c.redirect(`/p/${token}/d/${docId}${q}`, 303);
    const doc = snap.documents?.find((d) => d.id === docId);
    if (!doc) return c.html(<NotFoundPage />, 404);
    if (!doc.acceptable) return back();
    const form = await c.req.parseBody();
    const name = cleanName(form.name);
    if (name.length < 3) return back("?error=nombre");
    if (form.agree !== "1") return back("?error=casilla");
    await c.env.DB.prepare("INSERT OR IGNORE INTO acceptances (client_id, doc_id, sent_at, name, accepted_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(snap.client.id, doc.id, doc.acceptable.sentAt, name, new Date().toISOString(), clientIp(c), clientUa(c))
      .run();
    return back("?ok=1");
  });
});

// Va la última: /p/<token>/<proyecto> no debe tapar /mensajes ni /consent.
app.get("/p/:token/:projectId", (c) =>
  gate(c, (snap, token) => {
    const project = snap.projects.find((p) => p.id === c.req.param("projectId"));
    if (!project) return c.html(<NotFoundPage />, 404);
    return c.html(<ProjectPage snap={snap} project={project} token={token} />);
  }),
);

// ── API privada (tu app publica aquí) ──

const api = new Hono<{ Bindings: Env }>();

/** Comparación en tiempo constante del secreto. */
function sameSecret(a: string, b: string) {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

api.use("*", async (c, next) => {
  const secret = c.env.PORTAL_SECRET;
  if (!secret || secret.length < 16) return c.json({ error: "El portal no tiene PORTAL_SECRET configurado (mínimo 16 caracteres)" }, 503);
  const auth = c.req.header("authorization") ?? "";
  const given = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!sameSecret(given, secret)) return c.json({ error: "No autorizado" }, 401);
  await next();
});

api.get("/health", (c) => c.json({ ok: true, app: "leads-portal", version: 1 }));

/** Publica (crea o reemplaza) el portal de un cliente: { tokenHash, snapshot } */
api.put("/portals/:clientId", bodyLimit({ maxSize: 1024 * 1024 }), async (c) => {
  const body = await c.req.json<{ tokenHash?: string; snapshot?: PortalSnapshot }>().catch(() => undefined);
  const clientId = c.req.param("clientId");
  if (!body?.tokenHash || !/^[a-f0-9]{64}$/.test(body.tokenHash)) return c.json({ error: "tokenHash no válido" }, 400);
  if (!body.snapshot || body.snapshot.version !== 1 || body.snapshot.client?.id !== clientId) return c.json({ error: "Snapshot no válido" }, 400);
  const now = new Date().toISOString();
  // Enlace nuevo: los avisos activados con el anterior abrirían una dirección que ya no existe.
  const prev = await c.env.DB.prepare("SELECT token_hash FROM portals WHERE client_id = ?").bind(clientId).first<{ token_hash: string }>();
  if (prev && prev.token_hash !== body.tokenHash) await c.env.DB.prepare("DELETE FROM push_subscriptions WHERE client_id = ?").bind(clientId).run();
  await c.env.DB.prepare(
    `INSERT INTO portals (client_id, token_hash, snapshot, published_at) VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(client_id) DO UPDATE SET token_hash = ?2, snapshot = ?3, published_at = ?4`,
  )
    .bind(clientId, body.tokenHash, JSON.stringify(body.snapshot), now)
    .run();
  return c.json({ ok: true, publishedAt: now });
});

/** Publica tu marca y tus datos legales (PortalSite). */
api.put("/site", bodyLimit({ maxSize: 64 * 1024 }), async (c) => {
  const site = await c.req.json<PortalSite>().catch(() => undefined);
  if (!site || site.version !== 1 || typeof site.brand?.name !== "string" || typeof site.legal !== "object") return c.json({ error: "Datos no válidos" }, 400);
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `INSERT INTO site (key, value, updated_at) VALUES ('site', ?1, ?2)
     ON CONFLICT(key) DO UPDATE SET value = ?1, updated_at = ?2`,
  )
    .bind(JSON.stringify(site), now)
    .run();
  return c.json({ ok: true, updatedAt: now });
});

/** Aceptaciones hechas en el portal (tu app las recoge y actualiza el documento). */
api.get("/acceptances", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT client_id, doc_id, sent_at, name, accepted_at, ip, user_agent FROM acceptances ORDER BY accepted_at DESC LIMIT 500",
  ).all<{ client_id: string; doc_id: string; sent_at: string; name: string; accepted_at: string; ip: string | null; user_agent: string | null }>();
  return c.json(
    results.map((r) => ({
      clientId: r.client_id,
      docId: r.doc_id,
      sentAt: r.sent_at,
      name: r.name,
      acceptedAt: r.accepted_at,
      ...(r.ip ? { ip: r.ip } : {}),
      ...(r.user_agent ? { userAgent: r.user_agent } : {}),
    })),
  );
});

/**
 * Novedades para tu app: mensajes con seq > after, aceptaciones de las políticas
 * y cuándo vio cada cliente sus mensajes.
 */
api.get("/inbox", async (c) => {
  const after = Number(c.req.query("after") ?? 0) || 0;
  const [messages, consents, seen] = await c.env.DB.batch([
    c.env.DB.prepare("SELECT seq, id, client_id, author, body, project_id, project_name, created_at FROM messages WHERE seq > ? ORDER BY seq LIMIT 500").bind(after),
    c.env.DB.prepare("SELECT client_id, version, name, accepted_at, ip, user_agent FROM consents ORDER BY accepted_at"),
    c.env.DB.prepare("SELECT client_id, seen_at FROM message_seen"),
  ]);
  type M = { seq: number; id: string; client_id: string; author: string; body: string; project_id: string | null; project_name: string | null; created_at: string };
  type C = { client_id: string; version: string; name: string; accepted_at: string; ip: string | null; user_agent: string | null };
  return c.json({
    messages: (messages.results as M[]).map((m) => ({
      seq: m.seq,
      id: m.id,
      clientId: m.client_id,
      author: m.author,
      body: m.body,
      createdAt: m.created_at,
      ...(m.project_id ? { projectId: m.project_id } : {}),
      ...(m.project_name ? { projectName: m.project_name } : {}),
    })),
    consents: (consents.results as C[]).map((r) => ({
      clientId: r.client_id,
      version: r.version,
      name: r.name,
      acceptedAt: r.accepted_at,
      ...(r.ip ? { ip: r.ip } : {}),
      ...(r.user_agent ? { userAgent: r.user_agent } : {}),
    })),
    seen: Object.fromEntries((seen.results as { client_id: string; seen_at: string }[]).map((r) => [r.client_id, r.seen_at])),
  });
});

/** Tu respuesta a un cliente: { id, body, projectId?, projectName?, createdAt }. */
api.post("/portals/:clientId/messages", bodyLimit({ maxSize: 32 * 1024 }), async (c) => {
  const m = await c.req.json<{ id?: string; body?: string; projectId?: string; projectName?: string; createdAt?: string }>().catch(() => undefined);
  const clientId = c.req.param("clientId");
  if (!m?.id || !/^[a-f0-9-]{36}$/.test(m.id) || typeof m.body !== "string" || !m.body.trim() || m.body.length > 8000) return c.json({ error: "Mensaje no válido" }, 400);
  const exists = await c.env.DB.prepare("SELECT 1 FROM portals WHERE client_id = ?").bind(clientId).first();
  if (!exists) return c.json({ error: "Este cliente no tiene portal" }, 404);
  const createdAt = m.createdAt && !Number.isNaN(Date.parse(m.createdAt)) ? m.createdAt : new Date().toISOString();
  await c.env.DB.prepare("INSERT OR IGNORE INTO messages (id, client_id, author, body, project_id, project_name, created_at) VALUES (?, ?, 'admin', ?, ?, ?, ?)")
    .bind(m.id, clientId, m.body.trim(), m.projectId ?? null, m.projectName ?? null, createdAt)
    .run();
  const row = await c.env.DB.prepare("SELECT seq FROM messages WHERE id = ?").bind(m.id).first<{ seq: number }>();
  return c.json({ ok: true, seq: row?.seq });
});

/** Estado: cuándo se publicó, cuándo lo vio el cliente y en cuántos dispositivos tiene los avisos. */
api.get("/portals/:clientId", async (c) => {
  const id = c.req.param("clientId");
  const [portal, push] = await c.env.DB.batch([
    c.env.DB.prepare("SELECT published_at, last_viewed_at, views FROM portals WHERE client_id = ?").bind(id),
    c.env.DB.prepare("SELECT COUNT(*) AS n FROM push_subscriptions WHERE client_id = ?").bind(id),
  ]);
  const row = portal.results[0] as { published_at: string; last_viewed_at: string | null; views: number } | undefined;
  if (!row) return c.json({ error: "No publicado" }, 404);
  return c.json({ publishedAt: row.published_at, lastViewedAt: row.last_viewed_at ?? undefined, views: row.views, pushDevices: (push.results[0] as { n: number }).n });
});

/** Dispositivos del cliente con avisos: tu app les envía el push (con su clave VAPID). */
api.get("/portals/:clientId/push", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE client_id = ?")
    .bind(c.req.param("clientId"))
    .all<{ endpoint: string; p256dh: string; auth: string }>();
  return c.json(results.map((r) => ({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } })));
});

/** Suscripciones caducadas (el navegador las dio de baja): { endpoints: string[] }. */
api.post("/push/expired", bodyLimit({ maxSize: 64 * 1024 }), async (c) => {
  const body = await c.req.json<{ endpoints?: unknown }>().catch(() => undefined);
  const endpoints = Array.isArray(body?.endpoints) ? body.endpoints.filter((e): e is string => typeof e === "string").slice(0, 100) : [];
  if (endpoints.length) await c.env.DB.batch(endpoints.map((e) => c.env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").bind(e)));
  return c.json({ removed: endpoints.length });
});

/** Desactiva el portal de un cliente (el enlace deja de funcionar). */
api.delete("/portals/:clientId", async (c) => {
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM portals WHERE client_id = ?").bind(c.req.param("clientId")),
    c.env.DB.prepare("DELETE FROM acceptances WHERE client_id = ?").bind(c.req.param("clientId")),
    c.env.DB.prepare("DELETE FROM consents WHERE client_id = ?").bind(c.req.param("clientId")),
    c.env.DB.prepare("DELETE FROM messages WHERE client_id = ?").bind(c.req.param("clientId")),
    c.env.DB.prepare("DELETE FROM message_seen WHERE client_id = ?").bind(c.req.param("clientId")),
    c.env.DB.prepare("DELETE FROM push_subscriptions WHERE client_id = ?").bind(c.req.param("clientId")),
  ]);
  return c.body(null, 204);
});

app.route("/api", api);

app.notFound((c) => (c.req.path.startsWith("/api/") ? c.json({ error: "No encontrado" }, 404) : c.html(<NotFoundPage />, 404)));
app.onError((err, c) => {
  console.error(err);
  return c.req.path.startsWith("/api/") ? c.json({ error: "Error del portal" }, 500) : c.html(<NotFoundPage error />, 500);
});

export default app;
