/**
 * Tema claro/oscuro. La preferencia (light | dark | system) se guarda en
 * localStorage y se aplica como <html data-theme="light|dark">.
 */

export type ThemePreference = "light" | "dark" | "system";

export const THEME_KEY = "theme";
const EVENT = "themechange";

/** Script que se ejecuta antes de pintar, para evitar el destello del tema equivocado. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");var d=t==="dark"||((!t||t==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light")}catch(e){}})()`;

function systemIsDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function readPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function applyPreference(pref: ThemePreference) {
  const dark = pref === "dark" || (pref === "system" && systemIsDark());
  document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
}

export function setPreference(pref: ThemePreference) {
  try {
    if (pref === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, pref);
  } catch {
    /* sin almacenamiento: solo se aplica en esta visita */
  }
  applyPreference(pref);
  window.dispatchEvent(new Event(EVENT));
}

/** Para useSyncExternalStore: avisa de cambios propios y del sistema. */
export function subscribe(callback: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystem = () => {
    if (readPreference() === "system") applyPreference("system");
    callback();
  };
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  mq.addEventListener("change", onSystem);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
    mq.removeEventListener("change", onSystem);
  };
}
