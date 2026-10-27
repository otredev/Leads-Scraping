"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { useData } from "../data/DataProvider";
import { Card, Loading, PageHeader, Skeleton } from "../ui";

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-surface-2 px-1.5 py-0.5 text-[12.5px] text-fg-2">{children}</code>;
}

export function Modules() {
  const { modules, refreshModules } = useData();
  const [checking, setChecking] = useState(false);

  async function recheck() {
    setChecking(true);
    await refreshModules();
    setChecking(false);
  }

  return (
    <>
      <PageHeader
        title="Módulos"
        description={
          <>
            Piezas conectadas a la app. Para añadir una, crea su módulo y regístralo en <Code>src/modules/index.ts</Code>.
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
        <Loading label="Cargando módulos…">
          <div className="flex flex-col gap-5">
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
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              {["Fuentes", "Exportación", "Almacenamiento"].map((t) => (
                <Card key={t} title={t}>
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-3.5 w-1/2" />
                    <Skeleton className="h-3.5 w-3/4" />
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </Loading>
      ) : (
        <div className="flex flex-col gap-5">
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

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
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
            <Card title="Almacenamiento" description="Dónde se guardan búsquedas y leads">
              <p className="text-sm">
                <Code>{modules.storage.id}</Code>
              </p>
              <p className="mt-2 text-[13px] text-muted">
                Se cambia con la variable <Code>STORAGE</Code> en <Code>.env.local</Code>.
              </p>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
