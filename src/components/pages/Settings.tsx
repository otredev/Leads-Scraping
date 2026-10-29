"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bell, Bot, Database, Download, Globe, Pencil, Puzzle, Receipt, RefreshCw, Tags, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ImportSummary } from "@/core/storage";
import type { CrmSettings } from "@/core/crm";
import { DocumentSettingsDialog } from "../documents/dialogs";
import { FinanceSettingsDialog } from "../finance/FinanceSettingsDialog";
import { api, useData } from "../data/DataProvider";
import { CrmSettingsCard } from "../settings/CrmSettingsCard";
import { TemplatesCard } from "../settings/TemplatesCard";
import { AppCard, ClaudeCard } from "../settings/ClaudeCard";
import { NotificationsCard } from "../settings/NotificationsCard";
import { PortalSettingsCard } from "../settings/PortalSettingsCard";
import { Card, Loading, Notice, PageHeader, Skeleton } from "../ui";

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[12.5px] text-fg-2">{children}</code>;
}

function summary(r: ImportSummary) {
  const total = r.searches + r.results + r.leads;
  if (!total) return "No había nada nuevo que importar.";
  return `Importado: ${r.searches} búsquedas, ${r.results} resultados y ${r.leads} leads guardados.`;
}

/** Copia de seguridad: descargar y restaurar (solo añade lo que falte). */
function BackupCard({ localDataAvailable, onDone }: { localDataAvailable: boolean; onDone(): void }) {
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string>();
  const [notice, setNotice] = useState<{ text: string; tone?: "error" }>();

  async function importFrom(key: string, run: () => Promise<ImportSummary>) {
    setBusy(key);
    setNotice(undefined);
    try {
      setNotice({ text: summary(await run()) });
      onDone();
    } catch (err) {
      setNotice({ text: (err as Error).message, tone: "error" });
    } finally {
      setBusy(undefined);
    }
  }

  async function restore(f: File) {
    await importFrom("file", async () => {
      let data: unknown;
      try {
        data = JSON.parse(await f.text());
      } catch {
        throw new Error("El archivo no es un JSON válido.");
      }
      return api<ImportSummary>("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    });
    if (file.current) file.current.value = "";
  }

  return (
    <Card title="Copia de seguridad" description="Búsquedas, resultados y leads guardados (incluida la papelera) en un archivo JSON">
      <div className="flex flex-col gap-4">
        {notice && (
          <Notice tone={notice.tone} onClose={() => setNotice(undefined)}>
            {notice.text}
          </Notice>
        )}
        <div className="flex flex-wrap gap-2">
          <a className="btn btn-primary" href="/api/backup">
            <Download className="size-4" aria-hidden />
            Descargar copia
          </a>
          <button className="btn" onClick={() => file.current?.click()} disabled={busy === "file"}>
            <Upload className="size-4" aria-hidden />
            {busy === "file" ? "Restaurando…" : "Restaurar desde archivo"}
          </button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="Archivo de copia de seguridad"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void restore(f);
            }}
          />
        </div>
        <p className="hint">Restaurar solo añade lo que falte: nunca sobrescribe ni borra datos existentes.</p>
        {localDataAvailable && (
          <div className="flex flex-col gap-2 rounded-xl border border-line p-4">
            <p className="text-sm font-medium">Hay datos de la versión local (carpeta data/)</p>
            <p className="hint">Puedes pasarlos a la base de datos actual. Los ficheros locales no se modifican.</p>
            <div>
              <button
                className="btn btn-sm"
                disabled={busy === "local"}
                onClick={() => importFrom("local", () => api<ImportSummary>("/api/backup?from=json-file", { method: "POST" }))}
              >
                <Database className="size-4" aria-hidden />
                {busy === "local" ? "Importando…" : "Importar datos locales"}
              </button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function SkeletonCards({ titles }: { titles: string[] }) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {titles.map((t) => (
        <Card key={t} title={t}>
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3.5 w-1/2" />
            <Skeleton className="h-3.5 w-3/4" />
            <Skeleton className="h-9 w-40 rounded-lg" />
          </div>
        </Card>
      ))}
    </div>
  );
}

const SECTIONS = [
  { id: "general", label: "General", Icon: Database, description: "Base de datos y copias de seguridad" },
  { id: "crm", label: "CRM", Icon: Tags, description: "Etapas, etiquetas y plantillas de mensaje" },
  { id: "portal", label: "Portal del cliente", Icon: Globe, description: "Tu marca, conexión con Cloudflare y datos legales" },
  { id: "facturacion", label: "Documentos y finanzas", Icon: Receipt, description: "IVA, IRPF, IBAN, coste de tu hora y moneda" },
  { id: "notificaciones", label: "Notificaciones y app", Icon: Bell, description: "Avisos push e instalación como app" },
  { id: "integraciones", label: "Integraciones", Icon: Bot, description: "Claude (MCP)" },
  { id: "modulos", label: "Módulos", Icon: Puzzle, description: "Proveedores, enriquecedores, fuentes y exportación" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

/** Ancla para enlazar una tarjeta desde el buscador (/ajustes?seccion=crm#plantillas). */
function Anchor({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <div id={id} className="scroll-mt-6">
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="text-right">{value ?? <span className="text-muted">—</span>}</dd>
    </>
  );
}

/** Documentos y finanzas: resumen de sus ajustes y acceso a editarlos. */
function BillingSection({ settings }: { settings: CrmSettings }) {
  const [open, setOpen] = useState<"documents" | "finance">();
  const d = settings.documents ?? {};
  const f = settings.finance ?? {};
  const legal = settings.portal ?? {};
  const currency = f.currency ?? "EUR";
  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
      <Anchor id="documentos">
        <Card
          title="Documentos"
          description="Valores por defecto de propuestas y facturas"
          actions={
            <button className="btn btn-sm" onClick={() => setOpen("documents")}>
              <Pencil className="size-3.5" aria-hidden /> Editar
            </button>
          }
        >
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[13.5px]">
            <Row label="IVA" value={`${d.vat ?? 21} %`} />
            <Row label="Retención IRPF" value={d.irpf ? `${d.irpf} %` : "Sin retención"} />
            <Row label="Vencimiento" value={`${d.paymentDays ?? 30} días`} />
            <Row label="IBAN" value={d.iban} />
            <Row label="Pie de factura" value={d.invoiceFooter ? <span className="line-clamp-2">{d.invoiceFooter}</span> : undefined} />
          </dl>
          <p className="hint mt-3">
            Tus datos fiscales (titular, NIF, domicilio) salen de{" "}
            <Link href="/ajustes?seccion=portal#datos-legales" className="underline underline-offset-2">
              Portal del cliente → Datos legales
            </Link>
            {legal.taxId ? "." : ": todavía no los has rellenado y sin ellos no se pueden emitir facturas."}
          </p>
        </Card>
      </Anchor>
      <Anchor id="finanzas">
        <Card
          title="Finanzas"
          description="Cómo se calcula la rentabilidad"
          actions={
            <button className="btn btn-sm" onClick={() => setOpen("finance")}>
              <Pencil className="size-3.5" aria-hidden /> Editar
            </button>
          }
        >
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-[13.5px]">
            <Row label="Coste de tu hora" value={f.hourlyCost ? `${f.hourlyCost} ${currency}` : "Sin definir (las horas no cuentan como coste)"} />
            <Row label="Moneda" value={currency} />
          </dl>
          <p className="hint mt-3">
            Los gastos se gestionan en{" "}
            <Link href="/finanzas?vista=gastos" className="underline underline-offset-2">
              Finanzas → Gastos
            </Link>
            .
          </p>
        </Card>
      </Anchor>
      {open === "documents" && <DocumentSettingsDialog onClose={() => setOpen(undefined)} />}
      {open === "finance" && <FinanceSettingsDialog current={f} currency={currency} onClose={() => setOpen(undefined)} onSaved={() => setOpen(undefined)} />}
    </div>
  );
}

export function Settings() {
  const { modules, settings, refreshModules, refreshSearches, refreshSaved, refreshSettings } = useData();
  const [checking, setChecking] = useState(false);
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const section: SectionId = SECTIONS.find((x) => x.id === params.get("seccion"))?.id ?? "general";
  const current = SECTIONS.find((x) => x.id === section)!;
  const ready = Boolean(modules && settings);

  // Al llegar con #ancla (p. ej. desde el buscador), baja hasta esa tarjeta cuando ya está pintada.
  useEffect(() => {
    if (!ready) return;
    const id = window.location.hash.slice(1);
    if (!id) return;
    const t = setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
    return () => clearTimeout(t);
  }, [ready, section, params]);

  // En el móvil el índice es una fila desplazable: deja visible la sección activa.
  useEffect(() => {
    document.querySelector<HTMLElement>("[data-settings-tab][aria-current=page]")?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [section]);

  async function recheck() {
    setChecking(true);
    await refreshModules();
    setChecking(false);
  }

  return (
    <>
      <PageHeader
        title="Ajustes"
        description="Configura la base de datos, el CRM, el portal del cliente, la facturación, los avisos y los módulos."
        actions={
          <button className="btn" onClick={recheck} disabled={checking}>
            <RefreshCw className={`size-4 ${checking ? "animate-spin" : ""}`} aria-hidden />
            Comprobar conexión
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Secciones de ajustes" className="lg:sticky lg:top-6 lg:self-start">
          <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
            {SECTIONS.map(({ id, label, Icon }) => (
              <li key={id} className="shrink-0">
                <Link
                  href={`${pathname}?seccion=${id}`}
                  scroll={false}
                  aria-current={section === id ? "page" : undefined}
                  data-settings-tab
                  onClick={(e) => {
                    e.preventDefault();
                    router.replace(`${pathname}?seccion=${id}`, { scroll: false });
                  }}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap ${
                    section === id ? "bg-primary-soft text-primary" : "text-fg-2 hover:bg-surface-2 hover:text-fg"
                  }`}
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <section aria-labelledby="settings-section" className="flex min-w-0 flex-col gap-5">
          <header>
            <h2 id="settings-section" className="text-lg font-semibold">
              {current.label}
            </h2>
            <p className="text-[13.5px] text-muted">{current.description}</p>
          </header>

          {!modules || !settings ? (
            <Loading label="Cargando ajustes…">
              <SkeletonCards titles={[current.label, ""]} />
            </Loading>
          ) : section === "general" ? (
            <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
              <Anchor id="base-de-datos">
                <Card title="Base de datos" description="Dónde se guardan búsquedas, resultados y leads">
                  <div className="flex flex-col gap-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{modules.storage.label}</p>
                        <p className="text-xs text-muted">
                          <Code>{modules.storage.id}</Code>
                        </p>
                      </div>
                      <span className={`badge ${modules.storage.health.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
                        <span className={`size-1.5 rounded-full ${modules.storage.health.ok ? "bg-success" : "bg-danger"}`} aria-hidden />
                        {modules.storage.health.ok ? "Conectada" : "Sin conexión"}
                      </span>
                    </div>
                    <p className={modules.storage.health.ok ? "text-muted" : "text-danger"}>{modules.storage.health.message}</p>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t border-line pt-3 text-[13px]">
                      <dt className="text-muted">Papelera</dt>
                      <dd>
                        se vacía a los {modules.defaults.trashDays} días (<Code>TRASH_DAYS</Code>)
                      </dd>
                      <dt className="text-muted">País de teléfonos</dt>
                      <dd>
                        {modules.defaults.country} por defecto (<Code>DEFAULT_COUNTRY</Code>)
                      </dd>
                    </dl>
                    <p className="hint">
                      Se configura en <Code>.env.local</Code>: <Code>MONGODB_URI</Code> para MongoDB, o <Code>STORAGE=json-file</Code> para ficheros locales.
                    </p>
                  </div>
                </Card>
              </Anchor>
              <Anchor id="copia">
                <BackupCard
                  localDataAvailable={modules.storage.localDataAvailable}
                  onDone={() => {
                    void refreshSearches();
                    void refreshSaved();
                    void refreshSettings();
                  }}
                />
              </Anchor>
            </div>
          ) : section === "crm" ? (
            <>
              <Anchor id="etapas">
                <CrmSettingsCard key={JSON.stringify([settings.stages, settings.tags, settings.lowRating])} settings={settings} />
              </Anchor>
              <Anchor id="plantillas">
                <TemplatesCard key={JSON.stringify(settings.templates)} settings={settings} />
              </Anchor>
            </>
          ) : section === "portal" ? (
            <Anchor id="portal">
              <PortalSettingsCard key={JSON.stringify(settings.portal ?? {})} settings={settings} />
            </Anchor>
          ) : section === "facturacion" ? (
            <BillingSection settings={settings} />
          ) : section === "notificaciones" ? (
            <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
              <Anchor id="push">
                <NotificationsCard />
              </Anchor>
              <Anchor id="instalar">
                <AppCard />
              </Anchor>
            </div>
          ) : section === "integraciones" ? (
            <Anchor id="claude">
              <ClaudeCard mcp={modules.mcp} />
            </Anchor>
          ) : (
            <>
              <Anchor id="proveedores">
                <Card title="Proveedores" description="Herramientas que extraen los datos. Para añadir uno, créalo y regístralo en src/modules/index.ts" bodyClassName="px-5 pb-5">
                  <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                    {modules.providers.map((p) => {
                      const source = modules.sources.find((s) => s.id === p.sourceId);
                      return (
                        <li key={p.id} className="flex flex-col gap-3 rounded-xl border border-line p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold">{p.name}</p>
                              <p className="text-xs text-muted">
                                <Code>{p.id}</Code> · fuente: {source?.name ?? p.sourceId}
                              </p>
                            </div>
                            <span className={`badge ${p.health.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
                              <span className={`size-1.5 rounded-full ${p.health.ok ? "bg-success" : "bg-danger"}`} aria-hidden />
                              {p.health.ok ? "Disponible" : "No disponible"}
                            </span>
                          </div>
                          <p className="text-[13.5px] text-fg-2">{p.description}</p>
                          <p className={`text-[13px] ${p.health.ok ? "text-muted" : "text-danger"}`}>{p.health.message}</p>
                          {p.options.length > 0 && <p className="text-xs text-muted">Opciones: {p.options.map((o) => o.label).join(", ")}</p>}
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              </Anchor>
              <Anchor id="enriquecedores">
                <Card title="Enriquecedores" description="Completan datos de leads guardados (redes, emails…) desde otras fuentes" bodyClassName="px-5 pb-5">
                  <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                    {modules.enrichers.map((e) => (
                      <li key={e.id} className="flex flex-col gap-2 rounded-xl border border-line p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">{e.label}</p>
                            <p className="text-xs text-muted">
                              <Code>{e.id}</Code>
                              {e.requirement ? ` · ${e.requirement.toLowerCase()}` : ""}
                            </p>
                          </div>
                          <span className={`badge ${e.health.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}>
                            <span className={`size-1.5 rounded-full ${e.health.ok ? "bg-success" : "bg-danger"}`} aria-hidden />
                            {e.health.ok ? "Disponible" : "No disponible"}
                          </span>
                        </div>
                        <p className="text-[13.5px] text-fg-2">{e.description}</p>
                      </li>
                    ))}
                  </ul>
                  <p className="hint mt-3">Úsalos desde Leads: selecciona leads → &ldquo;Completar redes y emails&rdquo;, o desde la ficha de cada lead.</p>
                </Card>
              </Anchor>
              <Anchor id="fuentes">
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                  <Card title="Fuentes" description="De dónde salen los datos">
                    <ul className="flex flex-col gap-3">
                      {modules.sources.map((s) => (
                        <li key={s.id}>
                          <p className="font-medium">{s.name}</p>
                          <p className="text-[13px] text-muted">{s.description}</p>
                        </li>
                      ))}
                    </ul>
                  </Card>
                  <Card title="Exportación" description="Formatos de descarga">
                    <ul className="flex flex-col gap-2">
                      {modules.exporters.map((e) => (
                        <li key={e.id} className="flex items-center justify-between text-sm">
                          <span className="font-medium">{e.label}</span>
                          <Code>.{e.extension}</Code>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </div>
              </Anchor>
            </>
          )}
        </section>
      </div>
    </>
  );
}
