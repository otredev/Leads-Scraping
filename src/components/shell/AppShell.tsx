"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Blocks, LayoutDashboard, Menu, Search, Users, X } from "lucide-react";
import { useData } from "../data/DataProvider";
import { ThemeButton, ThemeSwitch } from "./ThemeToggle";
import { Skeleton } from "../ui";

const NAV = [
  { href: "/", label: "Panel", Icon: LayoutDashboard },
  { href: "/busquedas", label: "Búsquedas", Icon: Search },
  { href: "/leads", label: "Leads", Icon: Users },
  { href: "/modulos", label: "Módulos", Icon: Blocks },
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

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { searches } = useData();
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

function ProviderStatus() {
  const { modules } = useData();
  const main = modules?.providers[0];
  if (!modules)
    return (
      <div className="flex items-start gap-2 px-3 py-2" aria-hidden>
        <Skeleton className="mt-1 size-2 rounded-full" />
        <span className="flex flex-col gap-1.5">
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-3 w-20" />
        </span>
      </div>
    );
  if (!main) return null;
  return (
    <Link href="/modulos" className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs text-muted hover:bg-surface-2">
      <span
        className={`mt-1 size-2 shrink-0 rounded-full ${main.health.ok ? "bg-success" : "bg-danger"}`}
        aria-hidden
      />
      <span>
        <span className="block font-medium text-fg-2">{main.name.split(" (")[0]}</span>
        {main.health.ok ? "Conectado" : "Sin conexión"}
      </span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

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
          <ProviderStatus />
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
              <ProviderStatus />
              <ThemeSwitch />
            </div>
          </div>
        </div>
      )}

      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-[1400px]">{children}</div>
      </main>
    </div>
  );
}
