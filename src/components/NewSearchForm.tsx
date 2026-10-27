"use client";

import { useState } from "react";
import { ChevronDown, Link2, Play } from "lucide-react";
import { parseMapsUrl } from "@/core/mapsUrl";
import { COUNTRIES } from "@/core/countries";
import { defaultOptions, type OptionValues } from "@/core/options";
import type { Search } from "@/core/search";
import { OptionInput } from "./OptionInput";
import type { ModulesInfo } from "./types";

interface Props {
  modules: ModulesInfo;
  onCreated(search: Search): void;
}

export function NewSearchForm({ modules, onCreated }: Props) {
  const [providerId, setProviderId] = useState(modules.providers[0]?.id ?? "");
  const provider = modules.providers.find((p) => p.id === providerId);
  const [queries, setQueries] = useState("");
  const [lang, setLang] = useState(modules.defaults.lang);
  const [country, setCountry] = useState(modules.defaults.country);
  const [limit, setLimit] = useState("");
  const [options, setOptions] = useState<Record<string, OptionValues>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const values = provider ? { ...defaultOptions(provider.options), ...options[provider.id] } : {};
  const urls = queries
    .split("\n")
    .map((l) => parseMapsUrl(l))
    .filter((u): u is NonNullable<typeof u> => Boolean(u));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!provider) return;
    setBusy(true);
    setError(undefined);
    try {
      const res = await fetch("/api/searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId,
          queries: queries.split("\n"),
          lang,
          country,
          limit: limit ? Number(limit) : undefined,
          options: values,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "No se pudo crear la búsqueda");
      setQueries("");
      onCreated(body as Search);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={submit}>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="queries" className="label">
          Qué y dónde buscar
        </label>
        <textarea
          id="queries"
          rows={4}
          className="input resize-y leading-relaxed"
          value={queries}
          onChange={(e) => setQueries(e.target.value)}
          placeholder={"clínicas dentales en Valencia\nhttps://www.google.com/maps/search/fisioterapeutas/@40.41,-3.70,14z"}
          required
        />
        <p className="hint">
          Una búsqueda por línea, como en Google Maps. También puedes pegar la URL de Google Maps con la zona y los filtros que
          ya tengas puestos.
        </p>
        {urls.length > 0 && (
          <ul className="flex flex-col gap-1.5" aria-label="Enlaces de Google Maps detectados">
            {urls.map((u, i) => (
              <li key={i} className="flex items-start gap-2 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-[12.5px]">
                <Link2 className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden />
                <span className="min-w-0">
                  <span className="block font-medium text-fg">{u.label}</span>
                  {provider && !provider.acceptsMapsUrls && (
                    <span className="block text-muted">
                      {u.query ? `Este proveedor buscará el texto “${u.query}”, sin la zona ni los filtros.` : "Este proveedor no puede usar este enlace."}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="provider" className="label">
          Proveedor
        </label>
        <select id="provider" className="input" value={providerId} onChange={(e) => setProviderId(e.target.value)}>
          {modules.providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {provider && (
          <p className={`flex items-start gap-2 text-[12.5px] ${provider.health.ok ? "text-muted" : "text-danger"}`}>
            <span
              className={`mt-1.5 size-2 shrink-0 rounded-full ${provider.health.ok ? "bg-success" : "bg-danger"}`}
              aria-hidden
            />
            {provider.health.message}
          </p>
        )}
      </div>

      <div className="rounded-lg border border-line">
        <button
          type="button"
          className="flex w-full items-center justify-between px-3.5 py-2.5 text-sm font-medium text-fg-2 hover:text-fg"
          onClick={() => setShowAdvanced((v) => !v)}
          aria-expanded={showAdvanced}
        >
          Opciones avanzadas
          <ChevronDown className={`size-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`} aria-hidden />
        </button>
        {showAdvanced && provider && (
          <div className="flex flex-col gap-4 border-t border-line px-3.5 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="lang" className="label">
                  Idioma
                </label>
                <input id="lang" className="input" value={lang} maxLength={2} onChange={(e) => setLang(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="country" className="label">
                  País (teléfonos)
                </label>
                <select id="country" className="input" value={country} onChange={(e) => setCountry(e.target.value)}>
                  {[...new Set([country, ...COUNTRIES.map((c) => c[0])])].map((code) => (
                    <option key={code} value={code}>
                      {COUNTRIES.find((c) => c[0] === code)?.[1] ?? code}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="limit" className="label">
                  Máx. resultados
                </label>
                <input
                  id="limit"
                  className="input"
                  type="number"
                  min={1}
                  value={limit}
                  placeholder="Sin límite"
                  onChange={(e) => setLimit(e.target.value)}
                />
              </div>
            </div>
            {provider.options.map((f) => (
              <OptionInput
                key={`${provider.id}-${f.key}`}
                field={f}
                value={values[f.key]}
                onChange={(v) => setOptions((o) => ({ ...o, [provider.id]: { ...values, [f.key]: v } }))}
              />
            ))}
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      <button className="btn btn-primary py-2.5" type="submit" disabled={busy || !provider}>
        <Play className="size-4" aria-hidden />
        {busy ? "Iniciando…" : "Buscar negocios"}
      </button>
    </form>
  );
}
