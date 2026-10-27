/** Utilidades de la PWA en el navegador. */

export function swSupported() {
  return typeof navigator !== "undefined" && "serviceWorker" in navigator;
}

/** Registra el service worker (una vez). */
export function registerServiceWorker() {
  if (!swSupported()) return;
  navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => undefined);
}

/**
 * Muestra una notificación del sistema. Usa el service worker cuando existe
 * (obligatorio en Android y en la app instalada) y, si no, la API clásica.
 */
export async function showNotification(title: string, opts: { body?: string; tag?: string; url?: string }) {
  if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return;
  const options: NotificationOptions = {
    body: opts.body,
    tag: opts.tag,
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-96.png",
    data: { url: opts.url },
  };
  try {
    const reg = swSupported() ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg) return await reg.showNotification(title, options);
    new Notification(title, options);
  } catch {
    /* el navegador no permite notificaciones aquí */
  }
}

/** ¿La app se está usando instalada (ventana propia)? */
export function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

// ── Instalación (Chrome/Edge/Android) ──

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPromptEvent | undefined;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = undefined;
    installed = true;
    emit();
  });
}

export type InstallState = "installed" | "available" | "unavailable";

export function installState(): InstallState {
  if (installed || isStandalone()) return "installed";
  return deferred ? "available" : "unavailable";
}

export function subscribeInstall(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Abre el diálogo de instalación del navegador. */
export async function promptInstall() {
  if (!deferred) return false;
  const e = deferred;
  deferred = undefined;
  await e.prompt();
  const { outcome } = await e.userChoice;
  emit();
  return outcome === "accepted";
}

// ── Notificaciones push ──

export function pushSupported() {
  return swSupported() && typeof window !== "undefined" && "PushManager" in window && "Notification" in window;
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Suscripción push de este navegador, si existe. */
export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** Pide permiso y suscribe este navegador con la clave pública del servidor. */
export async function subscribePush(publicKey: string): Promise<PushSubscription> {
  if (!pushSupported()) throw new Error("Este navegador no admite notificaciones push.");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("No has permitido las notificaciones en este navegador.");
  registerServiceWorker();
  const reg = await navigator.serviceWorker.ready;
  // Si había una suscripción con otra clave (p. ej. otra base de datos), se rehace.
  await (await reg.pushManager.getSubscription())?.unsubscribe();
  try {
    return await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) });
  } catch (err) {
    const e = err as DOMException;
    if (e.name === "NotAllowedError") throw new Error("El navegador no ha permitido la suscripción. Revisa el permiso de notificaciones del sitio.");
    if (e.name === "AbortError" || /push service/i.test(e.message)) {
      throw new Error(
        "El servicio push del navegador no responde. En Brave, activa “Usar los servicios de Google para mensajería push” en Ajustes → Privacidad.",
      );
    }
    throw err;
  }
}

/** Mismo id que usa el servidor para una suscripción (sha256 del endpoint). */
export async function subscriptionId(endpoint: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

/** "Chrome en Windows", "Safari en iPhone"… */
export function deviceLabel(): string {
  if (typeof navigator === "undefined") return "Navegador";
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Navegador";
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /Mac OS X/.test(ua)
            ? "Mac"
            : /Linux/.test(ua)
              ? "Linux"
              : "";
  return `${browser}${os ? ` en ${os}` : ""}${isStandalone() ? " (app)" : ""}`;
}
