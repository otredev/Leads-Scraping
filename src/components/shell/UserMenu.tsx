"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { api } from "../data/DataProvider";
import { initials } from "../pages/Profile";
import { hardNavigate } from "../auth/safeNext";

interface Me {
  user: { name: string; email: string };
}

/** Tu cuenta en el menú lateral: enlace al perfil y cerrar sesión. */
export function UserMenu({ onNavigate }: { onNavigate?: () => void }) {
  const [me, setMe] = useState<Me>();
  useEffect(() => {
    const load = () => void api<Me>("/api/auth/me").then(setMe).catch(() => undefined);
    load();
    window.addEventListener("account:changed", load);
    return () => window.removeEventListener("account:changed", load);
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    hardNavigate("/login");
  }

  return (
    <div className="flex items-center gap-1">
      <Link href="/perfil" onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface-2" title="Perfil">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-[12px] font-semibold text-primary-fg" aria-hidden>
          {me ? initials(me.user.name) : ""}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13.5px] font-medium text-fg">{me?.user.name ?? "Tu cuenta"}</span>
          <span className="block truncate text-[11.5px] text-muted">{me?.user.email ?? " "}</span>
        </span>
      </Link>
      <button type="button" className="btn btn-ghost btn-sm px-2" onClick={() => void logout()} aria-label="Cerrar sesión" title="Cerrar sesión">
        <LogOut className="size-4" aria-hidden />
      </button>
    </div>
  );
}
