/**
 * Portal del cliente (Cloudflare Workers + D1).
 *
 * - /p/<token>            proyectos del cliente
 * - /p/<token>/<proyecto> avance, cronograma, tareas y pagos de un proyecto
 * - /p/<token>/d/<doc>    propuesta, contrato o factura (y aceptarla)
 * - /legal/<página>      aviso legal, privacidad y cookies (con tus datos de Ajustes)
 * - /api/*                API privada para que tu app publique (Bearer PORTAL_SECRET)
 *
 * El portal no conoce tu CRM: solo guarda el último snapshot que publica tu app.
 */
import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { bodyLimit } from "hono/body-limit";
import type { PortalSite, PortalSnapshot } from "../../src/core/portal";
import { CSS } from "./styles";
import { HomePage, NotFoundPage, ProjectPage, ProjectsPage } from "./pages";
import { DocumentPage } from "./documents";
import { LEGAL_PAGES, LegalPage, type LegalSlug } from "./legal";

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
app.get("/portal.css", (c) => {
  c.header("Cache-Control", "public, max-age=3600");
  return c.body(CSS, 200, { "Content-Type": "text/css; charset=utf-8" });
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

app.get("/p/:token", async (c) => {
  const snap = await loadPortal(c, c.req.param("token"));
  if (!snap) return c.html(<NotFoundPage />, 404);
  return c.html(<ProjectsPage snap={snap} token={c.req.param("token")} />);
});

app.get("/p/:token/:projectId", async (c) => {
  const snap = await loadPortal(c, c.req.param("token"));
  const project = snap?.projects.find((p) => p.id === c.req.param("projectId"));
  if (!snap || !project) return c.html(<NotFoundPage />, 404);
  return c.html(<ProjectPage snap={snap} project={project} token={c.req.param("token")} />);
});

app.get("/p/:token/d/:docId", async (c) => {
  const token = c.req.param("token");
  const snap = await loadPortal(c, token);
  const doc = snap?.documents?.find((d) => d.id === c.req.param("docId"));
  if (!snap || !doc) return c.html(<NotFoundPage />, 404);
  const stored = doc.acceptable ? await findAcceptance(c.env.DB, snap.client.id, doc.id, doc.acceptable.sentAt) : null;
  const acceptance = doc.acceptance ?? (stored ? { name: stored.name, at: stored.accepted_at } : undefined);
  return c.html(<DocumentPage snap={snap} doc={doc} token={token} acceptance={acceptance} error={c.req.query("error")} />);
});

/** El cliente acepta una propuesta o firma un contrato: nombre + casilla. */
app.post("/p/:token/d/:docId/accept", bodyLimit({ maxSize: 8 * 1024 }), async (c) => {
  const token = c.req.param("token");
  const docId = c.req.param("docId");
  const back = (q = "") => c.redirect(`/p/${token}/d/${docId}${q}`, 303);
  // Solo formularios enviados desde el propio portal.
  const origin = c.req.header("origin");
  if (origin && origin !== new URL(c.req.url).origin) return c.text("Origen no permitido", 403);
  const snap = await loadPortal(c, token, { countVisit: false });
  const doc = snap?.documents?.find((d) => d.id === docId);
  if (!snap || !doc) return c.html(<NotFoundPage />, 404);
  if (!doc.acceptable) return back();
  const form = await c.req.parseBody();
  const name = typeof form.name === "string" ? form.name.trim().replace(/\s+/g, " ").slice(0, 120) : "";
  if (name.length < 3) return back("?error=nombre");
  if (form.agree !== "1") return back("?error=casilla");
  await c.env.DB.prepare(
    "INSERT OR IGNORE INTO acceptances (client_id, doc_id, sent_at, name, accepted_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)",
  )
    .bind(snap.client.id, doc.id, doc.acceptable.sentAt, name, new Date().toISOString(), c.req.header("cf-connecting-ip") ?? null, (c.req.header("user-agent") ?? "").slice(0, 300) || null)
    .run();
  return back("?ok=1");
});

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

/** Estado: cuándo se publicó y cuándo lo vio el cliente por última vez. */
api.get("/portals/:clientId", async (c) => {
  const row = await c.env.DB.prepare("SELECT published_at, last_viewed_at, views FROM portals WHERE client_id = ?")
    .bind(c.req.param("clientId"))
    .first<{ published_at: string; last_viewed_at: string | null; views: number }>();
  if (!row) return c.json({ error: "No publicado" }, 404);
  return c.json({ publishedAt: row.published_at, lastViewedAt: row.last_viewed_at ?? undefined, views: row.views });
});

/** Desactiva el portal de un cliente (el enlace deja de funcionar). */
api.delete("/portals/:clientId", async (c) => {
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM portals WHERE client_id = ?").bind(c.req.param("clientId")),
    c.env.DB.prepare("DELETE FROM acceptances WHERE client_id = ?").bind(c.req.param("clientId")),
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
