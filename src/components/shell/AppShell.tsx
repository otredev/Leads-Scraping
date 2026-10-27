"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Briefcase, CalendarCheck, CalendarDays, LayoutDashboard, ListFilter, Menu, Search, Settings, Trash2, Users, X } from "lucide-react";
import { taskBucket } from "@/core/calendar";
import { TaskNotifier } from "../tasks/TaskNotifier";
import { useData } from "../data/DataProvider";
import { ThemeButton, ThemeSwitch } from "./ThemeToggle";
import { Skeleton } from "../ui";
import { registerServiceWorker } from "@/lib/pwa";

const NAV = [
  { href: "/", label: "Panel", Icon: LayoutDashboard },
  { href: "/busquedas", label: "Búsquedas", Icon: Search },
  { href: "/resultados", label: "Resultados", Icon: ListFilter },
  { href: "/leads", label: "Leads", Icon: Users },
  { href: "/clientes", label: "Clientes", Icon: Briefcase },
  { href: "/tareas", label: "Tareas", Icon: CalendarCheck },
  { href: "/calendario", label: "Calendario", Icon: CalendarDays },
  { href: "/papelera", label: "Papelera", Icon: Trash2 },
  { href: "/ajustes", label: "Ajustes", Icon: Settings },
];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight text-fg">
      <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-fg" aria-hidden>
        <svg viewBox="0 0 24 24" className="size-4.5" fill="currentColor">
          <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5Z" />
        </svg>
      </span>
      <span className="text-[15px]">Leads Scraping</span>
    </Link>
  );
}

/**
 * El menú resalta la página actual con usePathname. En rutas con parámetros
 * desconocidos al compilar (/clientes/[id]) eso suspende, así que se envuelve
 * en Suspense con el mismo menú sin resaltar como respaldo.
 */
function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Suspense fallback={<NavList pathname="" onNavigate={onNavigate} />}>
      <CurrentNavLinks onNavigate={onNavigate} />
    </Suspense>
  );
}

function CurrentNavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return <NavList pathname={usePathname()} onNavigate={onNavigate} />;
}

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const { searches, savedKeys, tasks } = useData();
  const pending = tasks.filter((t) => ["overdue", "today"].includes(taskBucket(t))).length;
  const active = searches.filter((s) => s.status === "running" || s.status === "queued").length;
  return (
    <ul className="flex flex-col gap-1">
      {NAV.map(({ href, label, Icon }) => {
        const current = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={current ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                current ? "bg-primary-soft text-primary" : "text-fg-2 hover:bg-surface-2 hover:text-fg"
              }`}
            >
              <Icon className="size-[18px]" aria-hidden />
              <span className="flex-1">{label}</span>
              {href === "/tareas" && pending > 0 && (
                <span className="badge bg-primary text-primary-fg" title={`${pending} vencidas o para hoy`}>
                  {pending}
                </span>
              )}
              {href === "/leads" && savedKeys.size > 0 && (
                <span className="text-xs tabular-nums text-muted">{savedKeys.size}</span>
              )}
              {href === "/busquedas" && active > 0 && (
                <span className="badge bg-primary text-primary-fg" title={`${active} en curso`}>
                  {active}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function StatusRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`size-2 shrink-0 rounded-full ${ok ? "bg-success" : "bg-danger"}`} aria-hidden />
      <span className="font-medium text-fg-2">{label}</span>
      <span className="ml-auto">{ok ? "Conectado" : "Sin conexión"}</span>
    </span>
  );
}

/** Estado de las conexiones (proveedor principal y base de datos). */
function ConnectionStatus() {
  const { modules } = useData();
  if (!modules)
    return (
      <div className="flex flex-col gap-2 px-3 py-2" aria-hidden>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
      </div>
    );
  const main = modules.providers[0];
  return (
    <Link href="/ajustes" className="flex flex-col gap-1.5 rounded-lg px-3 py-2 text-xs text-muted hover:bg-surface-2">
      {main && <StatusRow ok={main.health.ok} label={main.name.split(" (")[0]} />}
      <StatusRow ok={modules.storage.health.ok} label={modules.storage.label} />
    </Link>
  );
}

function ErrorBanner() {
  const { error, modules } = useData();
  const dbDown = modules && !modules.storage.health.ok ? modules.storage.health.message : undefined;
  const msg = dbDown ?? error;
  if (!msg) return null;
  return (
    <div role="alert" className="mb-6 rounded-card border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
      <span className="font-medium">{dbDown ? "La base de datos no responde. " : ""}</span>
      {msg}{" "}
      <Link href="/ajustes" className="font-medium underline underline-offset-2">
        Ver ajustes
      </Link>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => registerServiceWorker(), []);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      {/* Barra lateral (escritorio) */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface px-4 py-5 lg:flex">
        <div className="px-2">
          <Logo />
        </div>
        <nav aria-label="Principal" className="mt-8 flex-1">
          <NavLinks />
        </nav>
        <div className="flex flex-col gap-3">
          <ConnectionStatus />
          <ThemeSwitch />
        </div>
      </aside>

      {/* Cabecera (móvil) */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/90 px-4 py-3 backdrop-blur lg:hidden">
        <Logo />
        <div className="flex items-center gap-1">
          <ThemeButton />
          <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)} aria-label="Abrir menú" aria-expanded={open}>
            <Menu className="size-5" aria-hidden />
          </button>
        </div>
      </header>

      {/* Menú lateral (móvil) */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-surface px-4 py-5 shadow-pop">
            <div className="flex items-center justify-between px-2">
              <Logo />
              <button className="btn btn-ghost btn-sm" onClick={() => setOpen(false)} aria-label="Cerrar menú">
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <nav aria-label="Principal" className="mt-8 flex-1">
              <NavLinks onNavigate={() => setOpen(false)} />
            </nav>
            <div className="flex flex-col gap-3">
              <ConnectionStatus />
              <ThemeSwitch />
            </div>
          </div>
        </div>
      )}

      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-[1400px]">
          <ErrorBanner />
          {children}
          <TaskNotifier />
        </div>
      </main>
    </div>
  );
}
