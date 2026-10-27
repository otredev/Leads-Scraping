/**
 * Portal del cliente (Cloudflare Workers + D1).
 *
 * - /p/<token>            proyectos del cliente
 * - /p/<token>/<proyecto> avance, cronograma, tareas y pagos de un proyecto
 * - /api/*                API privada para que tu app publique (Bearer PORTAL_SECRET)
 *
 * El portal no conoce tu CRM: solo guarda el último snapshot que publica tu app.
 */
import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { bodyLimit } from "hono/body-limit";
import type { PortalSnapshot } from "../../src/core/portal";
import { CSS } from "./styles";
import { HomePage, NotFoundPage, ProjectPage, ProjectsPage } from "./pages";

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
      formAction: ["'none'"],
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

// ── Páginas del cliente ──

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function loadPortal(c: { env: Env; executionCtx: { waitUntil(p: Promise<unknown>): void } }, token: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return undefined;
  const hash = await sha256(token);
  const row = await c.env.DB.prepare("SELECT client_id, snapshot FROM portals WHERE token_hash = ?").bind(hash).first<{ client_id: string; snapshot: string }>();
  if (!row) return undefined;
  // Registrar la visita sin retrasar la respuesta.
  c.executionCtx.waitUntil(
    c.env.DB.prepare("UPDATE portals SET last_viewed_at = ?, views = views + 1 WHERE client_id = ?").bind(new Date().toISOString(), row.client_id).run(),
  );
  return JSON.parse(row.snapshot) as PortalSnapshot;
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
  await c.env.DB.prepare("DELETE FROM portals WHERE client_id = ?").bind(c.req.param("clientId")).run();
  return c.body(null, 204);
});

app.route("/api", api);

app.notFound((c) => (c.req.path.startsWith("/api/") ? c.json({ error: "No encontrado" }, 404) : c.html(<NotFoundPage />, 404)));
app.onError((err, c) => {
  console.error(err);
  return c.req.path.startsWith("/api/") ? c.json({ error: "Error del portal" }, 500) : c.html(<NotFoundPage error />, 500);
});

export default app;
