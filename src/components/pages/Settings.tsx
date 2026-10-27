"use client";

import { Database, Download, RefreshCw, Upload } from "lucide-react";
import { useRef, useState } from "react";
import type { ImportSummary } from "@/core/storage";
import { api, useData } from "../data/DataProvider";
import { CrmSettingsCard } from "../settings/CrmSettingsCard";
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

export function Settings() {
  const { modules, settings, refreshModules, refreshSearches, refreshSaved, refreshSettings } = useData();
  const [checking, setChecking] = useState(false);

  async function recheck() {
    setChecking(true);
    await refreshModules();
    setChecking(false);
  }

  return (
    <>
      <PageHeader
        title="Ajustes"
        description={
          <>
            Base de datos, copias de seguridad y módulos conectados. Para añadir un módulo, créalo y regístralo en{" "}
            <Code>src/modules/index.ts</Code>.
          </>
        }
        actions={
          <button className="btn" onClick={recheck} disabled={checking}>
            <RefreshCw className={`size-4 ${checking ? "animate-spin" : ""}`} aria-hidden />
            Comprobar conexión
          </button>
        }
      />

      {!modules ? (
        <Loading label="Cargando ajustes…">
          <div className="flex flex-col gap-5">
            <SkeletonCards titles={["Base de datos", "Copia de seguridad"]} />
            <SkeletonCards titles={["Etapas y etiquetas"]} />
            <Card title="Proveedores" description="Herramientas que extraen los datos">
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {[0, 1].map((i) => (
                  <div key={i} className="flex flex-col gap-3 rounded-xl border border-line p-4">
                    <div className="flex justify-between">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                    <Skeleton className="h-3.5 w-full" />
                    <Skeleton className="h-3.5 w-2/3" />
                  </div>
                ))}
              </div>
            </Card>
            <SkeletonCards titles={["Fuentes", "Exportación"]} />
          </div>
        </Loading>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card title="Base de datos" description="Dónde se guardan búsquedas, resultados y leads">
              <div className="flex flex-col gap-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{modules.storage.label}</p>
                    <p className="text-xs text-muted">
                      <Code>{modules.storage.id}</Code>
                    </p>
                  </div>
                  <span
                    className={`badge ${modules.storage.health.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${modules.storage.health.ok ? "bg-success" : "bg-danger"}`}
                      aria-hidden
                    />
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
                  Se configura en <Code>.env.local</Code>: <Code>MONGODB_URI</Code> para MongoDB, o{" "}
                  <Code>STORAGE=json-file</Code> para ficheros locales.
                </p>
              </div>
            </Card>
            <BackupCard
              localDataAvailable={modules.storage.localDataAvailable}
              onDone={() => {
                void refreshSearches();
                void refreshSaved();
                void refreshSettings();
              }}
            />
          </div>
          {settings ? (
            <CrmSettingsCard key={JSON.stringify([settings.stages, settings.tags, settings.lowRating])} settings={settings} />
          ) : (
            <SkeletonCards titles={["Etapas y etiquetas"]} />
          )}

          <Card title="Proveedores" description="Herramientas que extraen los datos" bodyClassName="px-5 pb-5">
            <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
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
                    {p.options.length > 0 && (
                      <p className="text-xs text-muted">
                        Opciones: {p.options.map((o) => o.label).join(", ")}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
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
        </div>
      )}
    </>
  );
}
