"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { readPreference, setPreference, subscribe, type ThemePreference } from "@/lib/theme";

const OPTIONS: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Claro", Icon: Sun },
  { value: "dark", label: "Oscuro", Icon: Moon },
  { value: "system", label: "Sistema", Icon: Monitor },
];

function usePreference() {
  return useSyncExternalStore(subscribe, readPreference, () => "system" as ThemePreference);
}

/** Selector de tres posiciones para la barra lateral. */
export function ThemeSwitch() {
  const pref = usePreference();
  return (
    <div role="radiogroup" aria-label="Tema" className="grid grid-cols-3 gap-1 rounded-lg bg-surface-2 p-1">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          role="radio"
          aria-checked={pref === value}
          onClick={() => setPreference(value)}
          className={`flex items-center justify-center gap-1 rounded-md px-1.5 py-1.5 text-xs font-medium transition-colors ${
            pref === value ? "bg-surface text-fg shadow-card" : "text-muted hover:text-fg"
          }`}
        >
          <Icon className="size-3.5" aria-hidden />
          {label}
        </button>
      ))}
    </div>
  );
}

/** Botón compacto (cabecera móvil): alterna entre claro y oscuro. */
export function ThemeButton() {
  usePreference();
  function toggle() {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    setPreference(isDark ? "light" : "dark");
  }
  return (
    <button onClick={toggle} className="btn btn-ghost btn-sm" aria-label="Cambiar entre tema claro y oscuro">
      <Sun className="size-4 dark:hidden" aria-hidden />
      <Moon className="hidden size-4 dark:block" aria-hidden />
    </button>
  );
}
