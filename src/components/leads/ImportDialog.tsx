"use client";

import { useEffect, useRef, useState } from "react";
import Papa from "papaparse";
import { FileUp, X } from "lucide-react";
import type { CrmSettings } from "@/core/crm";
import { COUNTRIES } from "@/core/countries";
import { IMPORT_TARGETS, guessMapping, toImportRows, type ImportMapping } from "@/core/importCsv";
import { postJson } from "../data/DataProvider";
import { ColorDot } from "./parts";

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  duplicates: number;
  newTags: number;
}

interface Parsed {
  fileName: string;
  headers: string[];
  rows: Record<string, string>[];
}

/** Importar leads desde un CSV: elegir archivo → revisar columnas → importar. */
export function ImportDialog({
  settings,
  defaultCountry,
  onClose,
  onDone,
}: {
  settings: CrmSettings;
  defaultCountry: string;
  onClose(): void;
  onDone(r: ImportResult): void;
}) {
  const [parsed, setParsed] = useState<Parsed>();
  const [mapping, setMapping] = useState<ImportMapping>({});
  const [stage, setStage] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [country, setCountry] = useState(defaultCountry);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  function read(file: File) {
    setError(undefined);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.replace(/^﻿/, "").trim(),
      complete: (res) => {
        const headers = (res.meta.fields ?? []).filter(Boolean);
        if (!headers.length || !res.data.length) {
          setError("No se encontraron filas. ¿Tiene la primera fila con los nombres de las columnas?");
          return;
        }
        setParsed({ fileName: file.name, headers, rows: res.data });
        setMapping(guessMapping(headers));
      },
      error: (err) => setError(`No se pudo leer el archivo: ${err.message}`),
    });
  }

  const rows = parsed ? toImportRows(parsed.rows, mapping) : [];
  const hasName = Object.values(mapping).includes("name");

  async function submit() {
    setBusy(true);
    setError(undefined);
    try {
      const r = await postJson<ImportResult>("/api/leads/import", { rows, stage: stage || undefined, tags, country });
      onDone(r);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="import-title">
      <div className="absolute inset-0 bg-black/40" onClick={() => !busy && onClose()} />
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-card border border-line bg-surface shadow-pop">
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 id="import-title" className="text-lg font-semibold">
              Importar leads desde CSV
            </h2>
            <p className="text-[13px] text-muted">{parsed ? parsed.fileName : "Se añaden directamente a Leads."}</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy} aria-label="Cerrar">
            <X className="size-5" aria-hidden />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <p role="alert" className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          {!parsed ? (
            <div
              className={`flex flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed px-6 py-14 text-center ${
                dragging ? "border-fg bg-surface-2" : "border-line-strong"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const f = e.dataTransfer.files[0];
                if (f) read(f);
              }}
            >
              <FileUp className="size-8 text-muted" aria-hidden />
              <p className="font-medium">Arrastra aquí un archivo CSV</p>
              <p className="max-w-md text-[13px] text-muted">
                Con una fila de cabecera. Detecto solo las columnas habituales (nombre, teléfono, email, web, dirección, etapa, etiquetas, notas…) y
                también los CSV exportados desde esta app.
              </p>
              <button className="btn btn-primary" onClick={() => fileRef.current?.click()}>
                Elegir archivo
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                aria-label="Archivo CSV"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) read(f);
                }}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <section>
                <h3 className="mb-2 text-sm font-semibold">Columnas</h3>
                <div className="overflow-x-auto rounded-lg border border-line">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line bg-surface-2 text-left text-xs text-muted">
                        <th className="px-3 py-2 font-medium">Columna del archivo</th>
                        <th className="px-3 py-2 font-medium">Ejemplo</th>
                        <th className="px-3 py-2 font-medium">Importar como</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.headers.map((h) => {
                        const sample = parsed.rows.find((r) => r[h]?.trim())?.[h] ?? "";
                        const used = new Set(Object.entries(mapping).filter(([k, v]) => v && k !== h).map(([, v]) => v));
                        return (
                          <tr key={h} className="border-b border-line last:border-0">
                            <td className="px-3 py-2 font-medium">{h}</td>
                            <td className="max-w-[220px] truncate px-3 py-2 text-muted" title={sample}>
                              {sample || "—"}
                            </td>
                            <td className="px-3 py-1.5">
                              <select
                                className="input py-1.5"
                                value={mapping[h] ?? ""}
                                onChange={(e) => setMapping((m) => ({ ...m, [h]: e.target.value as ImportMapping[string] }))}
                                aria-label={`Importar ${h} como`}
                              >
                                <option value="">No importar</option>
                                {IMPORT_TARGETS.map((t) => (
                                  <option key={t.id} value={t.id} disabled={used.has(t.id)}>
                                    {t.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {!hasName && <p className="mt-2 text-[13px] text-danger">Elige qué columna es el Nombre: es obligatoria.</p>}
              </section>

              <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="label" htmlFor="imp-stage">
                    Etapa (si la fila no trae una)
                  </label>
                  <select id="imp-stage" className="input" value={stage} onChange={(e) => setStage(e.target.value)}>
                    <option value="">Por defecto (Leads)</option>
                    {settings.stages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="label" htmlFor="imp-country">
                    País de los teléfonos sin prefijo
                  </label>
                  <select id="imp-country" className="input" value={country} onChange={(e) => setCountry(e.target.value)}>
                    {[...new Set([country, ...COUNTRIES.map((c) => c[0])])].map((code) => (
                      <option key={code} value={code}>
                        {COUNTRIES.find((c) => c[0] === code)?.[1] ?? code}
                      </option>
                    ))}
                  </select>
                </div>
                {settings.tags.length > 0 && (
                  <fieldset className="flex flex-col gap-1.5 sm:col-span-2">
                    <legend className="label mb-1.5">Añadir a todos estas etiquetas</legend>
                    <div className="flex flex-wrap gap-2">
                      {settings.tags.map((t) => (
                        <label key={t.id} className="flex cursor-pointer items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[13px]">
                          <input
                            type="checkbox"
                            className="size-3.5 accent-primary"
                            checked={tags.includes(t.id)}
                            onChange={(e) => setTags((ts) => (e.target.checked ? [...ts, t.id] : ts.filter((x) => x !== t.id)))}
                          />
                          <ColorDot color={t.color} className="size-2" />
                          {t.name}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}
              </section>
              <p className="hint">
                Los negocios que ya tengas (mismo Id de Google, o mismo nombre y dirección) solo actualizan sus datos: su etapa, etiquetas y
                notas no cambian. Las etiquetas del archivo que no existan se crean.
              </p>
            </div>
          )}
        </div>

        {parsed && (
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4">
            <span className="text-sm text-muted">
              <strong className="text-fg">{rows.length}</strong> de {parsed.rows.length} filas tienen nombre y se importarán.
            </span>
            <span className="flex gap-2">
              <button className="btn" onClick={() => setParsed(undefined)} disabled={busy}>
                Otro archivo
              </button>
              <button className="btn btn-primary" onClick={submit} disabled={busy || !hasName || !rows.length}>
                {busy ? "Importando…" : `Importar ${rows.length}`}
              </button>
            </span>
          </footer>
        )}
      </div>
    </div>
  );
}
