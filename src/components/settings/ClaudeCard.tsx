"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { Check, Copy, Download, MonitorSmartphone } from "lucide-react";
import type { ModulesInfo } from "../types";
import { installState, isStandalone, promptInstall, subscribeInstall } from "@/lib/pwa";
import { Card } from "../ui";

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium">{label}</span>
        <button
          className="btn btn-ghost btn-sm text-xs"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* sin portapapeles */
            }
          }}
        >
          {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-lg bg-surface-2 px-3 py-2 text-[12px] leading-relaxed text-fg-2">{text}</pre>
    </div>
  );
}

const TABS = [
  { id: "code", label: "Claude Code" },
  { id: "desktop", label: "Claude Desktop" },
  { id: "web", label: "claude.ai" },
] as const;

const useOrigin = () =>
  useSyncExternalStore(
    () => () => undefined,
    () => window.location.origin,
    () => "http://localhost:3000",
  );

/** Cómo conectar Claude al CRM por MCP. */
export function ClaudeCard({ mcp }: { mcp: ModulesInfo["mcp"] }) {
  const origin = useOrigin();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("code");
  const url = `${origin}${mcp.path}`;
  // Cada cuenta conecta Claude con su propio token: así Claude solo ve los datos de esa cuenta.
  const tokenNote = " (sustituye TU_TOKEN por tu token: Perfil → Conectar Claude)";

  const code = `claude mcp add --transport http leads-scraping ${url} --header "Authorization: Bearer TU_TOKEN"`;
  const desktop = JSON.stringify(
    {
      mcpServers: {
        "leads-scraping": {
          command: "npx",
          args: ["-y", "mcp-remote", url, "--header", "Authorization:${AUTH_HEADER}"],
          env: { AUTH_HEADER: "Bearer TU_TOKEN" },
        },
      },
    },
    null,
    2,
  );

  return (
    <Card title="Claude (MCP)" description="Maneja búsquedas, leads, tareas y mensajes hablando con Claude">
      <div className="flex flex-col gap-4">
        <p className="text-[13.5px] text-fg-2">
          Con el servidor MCP, Claude puede buscar negocios, guardarlos, moverlos de etapa, crear tareas, preparar mensajes y montar la página
          del negocio en Otrelink. La app tiene que estar abierta (<code className="text-[12.5px]">npm run dev</code>).
        </p>
        <CopyBlock label="Dirección del servidor" text={url} />

        <div role="tablist" aria-label="Cliente" className="flex gap-1 rounded-lg border border-line bg-surface p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={`flex-1 rounded-md px-2 py-1.5 text-[13px] font-medium ${tab === t.id ? "bg-primary text-primary-fg" : "text-fg-2 hover:bg-surface-2"}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "code" && <CopyBlock label={`Ejecuta en una terminal${tokenNote}`} text={code} />}
        {tab === "desktop" && (
          <>
            <CopyBlock label={`Añade a claude_desktop_config.json${tokenNote}`} text={desktop} />
            <p className="hint">En Claude Desktop: Ajustes → Desarrollador → Editar configuración. Necesita Node.js; reinicia Claude después.</p>
          </>
        )}
        {tab === "web" && (
          <div className="flex flex-col gap-2 text-[13.5px] text-fg-2">
            <p>
              claude.ai (web y móvil) solo conecta con servidores públicos por HTTPS. Cuando despliegues la app, añade un conector personalizado con
              esta dirección y tu token:
            </p>
            <CopyBlock label="Conector personalizado" text={`https://TU-DOMINIO${mcp.path}?token=TU_TOKEN`} />
          </div>
        )}

        <p className="hint">
          Crea tu token en{" "}
          <Link href="/perfil" className="underline underline-offset-2">
            Perfil → Conectar Claude
          </Link>
          : Claude trabajará solo con los datos de tu cuenta. Sin token, solo acepta conexiones desde este equipo y con la primera cuenta
          {mcp.token ? " (o con MCP_TOKEN)" : ""}.
        </p>
      </div>
    </Card>
  );
}

/** Instalar la app (PWA). */
export function AppCard() {
  const state = useSyncExternalStore(subscribeInstall, installState, () => "unavailable" as const);
  const ios = useSyncExternalStore(
    () => () => undefined,
    () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !isStandalone(),
    () => false,
  );

  return (
    <Card title="Instalar la app" description="Ábrela como una aplicación, con su propio icono y ventana">
      <div className="flex flex-col gap-3 text-[13.5px] text-fg-2">
        {state === "installed" ? (
          <p className="flex items-center gap-2 text-fg">
            <Check className="size-4" aria-hidden /> Estás usando la app instalada.
          </p>
        ) : state === "available" ? (
          <div>
            <button className="btn btn-primary" onClick={() => void promptInstall()}>
              <Download className="size-4" aria-hidden /> Instalar Leads Scraping
            </button>
          </div>
        ) : ios ? (
          <p>En iPhone o iPad: botón Compartir de Safari → &ldquo;Añadir a pantalla de inicio&rdquo;.</p>
        ) : (
          <p className="flex items-start gap-2">
            <MonitorSmartphone className="mt-0.5 size-4 text-muted" aria-hidden />
            <span>
              En Chrome o Edge, usa el icono de instalar de la barra de direcciones o el menú &ldquo;Instalar Leads Scraping&rdquo;. En Safari (Mac):
              Archivo → &ldquo;Añadir al Dock&rdquo;.
            </span>
          </p>
        )}
        <p className="hint">
          Instalada, los avisos de tareas salen como notificaciones del sistema. Para usarla en el móvil, la app debe estar desplegada con HTTPS
          (en local solo se instala en este equipo).
        </p>
      </div>
    </Card>
  );
}
