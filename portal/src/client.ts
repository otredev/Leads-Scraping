/**
 * JavaScript del portal (opcional: sin él todo funciona con formularios normales).
 * - Mensajes en vivo: comprueba si hay mensajes nuevos cada pocos segundos mientras
 *   la página está visible, y al instante cuando llega un aviso push.
 * - Avisos push: botón para activarlos o desactivarlos en este dispositivo.
 * Se sirve en /portal.js; el service worker, en /sw.js.
 */
export const CLIENT_JS = `"use strict";
(() => {
  const match = location.pathname.match(/^\\/p\\/([A-Za-z0-9_-]{20,100})(?:\\/|$)/);
  if (!match) return;
  const base = "/p/" + match[1];

  // Cabecera fija: más compacta y con sombra en cuanto se baja.
  const top = document.querySelector(".top");
  if (top) {
    const mark = () => top.classList.toggle("scrolled", scrollY > 8);
    addEventListener("scroll", mark, { passive: true });
    mark();
  }
  const sameOrigin = { credentials: "same-origin", headers: { "content-type": "application/json" } };

  // ── Mensajes en vivo ──
  const thread = document.querySelector("[data-live-thread]");
  const scroller = document.querySelector("[data-chat-scroll]");
  let after = thread ? Number(thread.getAttribute("data-after") || 0) : 0;

  function bubble(m) {
    const li = document.createElement("li");
    li.className = "msg " + (m.author === "client" ? "mine" : "theirs") + " msg-new";
    const meta = document.createElement("p");
    meta.className = "msg-meta";
    meta.textContent = m.meta;
    const body = document.createElement("p");
    body.className = "msg-body";
    body.textContent = m.body;
    li.append(meta, body);
    return li;
  }

  let current = null;
  // Si ya hay una consulta en marcha, se espera a que acabe y se hace otra.
  async function poll() {
    if (!thread) return;
    while (current) await current;
    current = fetchNew();
    try { await current; } finally { current = null; }
  }
  async function fetchNew() {
    try {
      const res = await fetch(base + "/mensajes.json?after=" + after, { credentials: "same-origin", cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (!data.messages || !data.messages.length) return;
      for (const m of data.messages) {
        thread.append(bubble(m));
        after = Math.max(after, m.seq);
      }
      thread.hidden = false;
      document.querySelectorAll("[data-thread-empty]").forEach((el) => el.remove());
      const limit = Number(thread.getAttribute("data-limit") || 0);
      while (limit && thread.children.length > limit) thread.firstElementChild.remove();
      const last = data.messages[data.messages.length - 1];
      const badge = document.querySelector("[data-new-reply]");
      if (badge) badge.hidden = last.author !== "admin";
      // Lo que escribe el propio cliente: bajar hasta el final de la conversación.
      if (scroller && last.author === "client") scroller.scrollTop = 0;
    } catch (e) {
      /* sin conexión: se reintenta en la próxima vuelta */
    }
  }

  if (thread) {
    setInterval(() => {
      if (document.visibilityState === "visible") poll();
    }, 8000);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") poll();
    });
    addEventListener("focus", poll);
  }

  // ── Mensajes anteriores: se cargan de 50 en 50 al llegar arriba ──
  // El historial usa column-reverse: scrollTop es 0 abajo y negativo al subir,
  // así que añadir mensajes arriba no mueve lo que se está leyendo.
  const more = document.querySelector("[data-load-older]");
  let loadingOlder = false;
  async function loadOlder() {
    if (!more || !more.isConnected || loadingOlder || !thread) return;
    loadingOlder = true;
    more.classList.add("loading");
    try {
      const res = await fetch(base + "/mensajes.json?before=" + more.getAttribute("data-before"), { credentials: "same-origin", cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const items = data.messages || [];
      const frag = document.createDocumentFragment();
      for (const m of items) {
        const b = bubble(m);
        b.classList.remove("msg-new");
        frag.append(b);
      }
      thread.prepend(frag);
      if (items.length) more.setAttribute("data-before", String(items[0].seq));
      if (!data.hasMore) more.remove();
    } catch (e) {
      /* se reintenta al volver a subir */
    } finally {
      more.classList.remove("loading");
      loadingOlder = false;
    }
  }
  if (more && scroller) {
    const link = more.querySelector("a");
    if (link) link.addEventListener("click", (e) => { e.preventDefault(); loadOlder(); });
    scroller.addEventListener("scroll", () => {
      if (scroller.scrollHeight - scroller.clientHeight - Math.abs(scroller.scrollTop) < 150) loadOlder();
    }, { passive: true });
  }

  // ── Escribir: el cuadro crece con el texto; se envía sin recargar la página ──
  const composer = document.querySelector("[data-composer]");
  if (composer && thread) {
    const area = composer.querySelector("textarea");
    const send = composer.querySelector("button[type=submit]");
    const grow = () => {
      area.style.height = "auto";
      area.style.height = Math.min(area.scrollHeight + 2, 180) + "px";
    };
    area.addEventListener("input", grow);
    // Con teclado físico, Enter envía y Mayús + Enter hace un salto de línea.
    const desktop = matchMedia("(pointer: fine)").matches;
    if (desktop) area.setAttribute("title", "Enter para enviar · Mayús + Enter para otra línea");
    area.addEventListener("keydown", (e) => {
      if (desktop && e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        composer.requestSubmit();
      }
    });
    const note = (text, tone) => {
      composer.querySelectorAll("[data-composer-note]").forEach((el) => el.remove());
      if (!text) return;
      const p = document.createElement("p");
      p.className = "callout composer-note " + tone;
      p.setAttribute("data-composer-note", "");
      p.setAttribute("role", tone === "err" ? "alert" : "status");
      p.textContent = text;
      composer.prepend(p);
    };
    const ERRORS = {
      vacio: "Escribe el mensaje.",
      largo: "El mensaje es demasiado largo.",
      limite: "Has enviado muchos mensajes seguidos. Espera un poco y vuelve a intentarlo.",
    };
    composer.addEventListener("submit", async (e) => {
      if (!area.value.trim()) { e.preventDefault(); return; }
      e.preventDefault();
      send.disabled = true;
      try {
        const res = await fetch(composer.action, { method: "POST", body: new FormData(composer), credentials: "same-origin" });
        const err = new URL(res.url).searchParams.get("error");
        if (!res.ok || err) throw new Error(err || "red");
        area.value = "";
        grow();
        note();
        await poll();
      } catch (x) {
        note(ERRORS[x.message] || "No se ha podido enviar. Revisa tu conexión e inténtalo de nuevo.", "err");
      } finally {
        send.disabled = false;
        area.focus();
      }
    });
    // Tras enviar sin JavaScript (?ok=1), dejar la dirección limpia.
    if (/[?&](ok|error)=/.test(location.search)) history.replaceState(null, "", location.pathname);
  }

  // ── Avisos push ──
  const card = document.querySelector("[data-push]");
  const key = card && card.getAttribute("data-key");
  if (!card || !key) return;
  const status = card.querySelector("[data-push-status]");
  const button = card.querySelector("[data-push-toggle]");
  const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

  function show(text, label) {
    card.hidden = false;
    status.textContent = text;
    if (label) {
      button.hidden = false;
      button.textContent = label;
    } else button.hidden = true;
  }

  if (!supported) {
    if (ios && !standalone) show("En iPhone y iPad, añade primero este portal a tu pantalla de inicio (botón Compartir → «Añadir a pantalla de inicio») y ábrelo desde allí para activar los avisos.");
    return;
  }

  const keyBytes = (() => {
    const b64 = (key + "===".slice((key.length + 3) % 4)).replace(/-/g, "+").replace(/_/g, "/");
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  })();
  const sameKey = (sub) => {
    const k = sub.options && sub.options.applicationServerKey;
    if (!k) return true;
    const a = new Uint8Array(k);
    return a.length === keyBytes.length && a.every((v, i) => v === keyBytes[i]);
  };
  const save = (sub) => fetch(base + "/push", { ...sameOrigin, method: "POST", body: JSON.stringify(sub.toJSON()) });
  const forget = (endpoint) => fetch(base + "/push", { ...sameOrigin, method: "POST", body: JSON.stringify({ endpoint, remove: true }) });

  let reg;
  async function refresh() {
    let sub = await reg.pushManager.getSubscription();
    // Si cambió tu clave de avisos, se renueva la suscripción sin preguntar otra vez.
    if (sub && !sameKey(sub)) {
      await sub.unsubscribe();
      sub = Notification.permission === "granted" ? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes }) : null;
    }
    if (sub) {
      save(sub).catch(() => {});
      show("Avisos activados en este dispositivo: te avisaremos cuando te respondamos o te enviemos un documento.", "Desactivar");
    } else if (Notification.permission === "denied") {
      show("Has bloqueado los avisos de este portal. Para recibirlos, permítelos en los ajustes del sitio de tu navegador.");
    } else {
      show("Activa los avisos y te llegará una notificación a este dispositivo cuando te respondamos o te enviemos un documento.", "Activar avisos");
    }
    return sub;
  }

  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await forget(sub.endpoint).catch(() => {});
        await sub.unsubscribe();
      } else {
        if ((await Notification.requestPermission()) === "granted") {
          const fresh = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes });
          const res = await save(fresh);
          if (!res.ok) throw new Error("save");
        }
      }
      await refresh();
    } catch (e) {
      show("No se han podido activar los avisos en este navegador. Inténtalo de nuevo más tarde.", "Reintentar");
    } finally {
      button.disabled = false;
    }
  });

  // Ámbito "/p/<token>" (sin barra final) para que cubra también la página principal.
  const active = (r) =>
    r.active
      ? Promise.resolve()
      : new Promise((resolve) => {
          const w = r.installing || r.waiting;
          if (!w) return resolve();
          w.addEventListener("statechange", () => w.state === "activated" && resolve());
        });
  navigator.serviceWorker
    .register("/sw.js", { scope: base })
    .then(async (r) => {
      reg = r;
      await active(r);
      await refresh();
    })
    .catch(() => {});
  // Un aviso recibido con la página abierta: traer los mensajes nuevos ya.
  navigator.serviceWorker.addEventListener("message", (e) => {
    if (e.data && e.data.type === "portal:refresh") poll();
  });
})();
`;

/** Service worker: muestra los avisos push y abre el portal al pulsarlos. No guarda nada en caché. */
export const SERVICE_WORKER_JS = `"use strict";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { body: event.data ? event.data.text() : "" };
  }
  const path = typeof data.path === "string" && !/^[a-z]+:|^\\/\\//i.test(data.path) ? data.path.replace(/^\\/+/, "") : "";
  const scope = self.registration.scope.endsWith("/") ? self.registration.scope : self.registration.scope + "/";
  const url = new URL(path, scope).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of windows) w.postMessage({ type: "portal:refresh" });
      await self.registration.showNotification(data.title || "Portal de clientes", {
        body: data.body || "",
        tag: data.tag,
        renotify: Boolean(data.tag),
        data: { url },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((w) => w.url.startsWith(self.registration.scope));
      if (open) {
        await open.focus();
        if ("navigate" in open) await open.navigate(url);
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
`;

const fnv = (s: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
};
export const CLIENT_JS_VERSION = fnv(CLIENT_JS);
