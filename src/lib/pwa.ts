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
