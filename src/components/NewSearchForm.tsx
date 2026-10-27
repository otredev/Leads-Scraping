"use client";

import { useState } from "react";
import { ChevronDown, Play } from "lucide-react";
import { defaultOptions, type OptionValues } from "@/core/options";
import type { Search } from "@/core/search";
import { OptionInput } from "./OptionInput";
import type { ModulesInfo } from "./types";

interface Props {
  modules: ModulesInfo;
  onCreated(search: Search): void;
}

/** Países habituales; el número se interpreta con este prefijo si no trae uno. */
const COUNTRIES: [string, string][] = [
  ["ES", "España (+34)"],
  ["MX", "México (+52)"],
  ["AR", "Argentina (+54)"],
  ["CO", "Colombia (+57)"],
  ["CL", "Chile (+56)"],
  ["PE", "Perú (+51)"],
  ["VE", "Venezuela (+58)"],
  ["EC", "Ecuador (+593)"],
  ["UY", "Uruguay (+598)"],
  ["DO", "Rep. Dominicana (+1)"],
  ["US", "Estados Unidos (+1)"],
  ["PT", "Portugal (+351)"],
  ["FR", "Francia (+33)"],
  ["IT", "Italia (+39)"],
  ["DE", "Alemania (+49)"],
  ["GB", "Reino Unido (+44)"],
];

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
          placeholder={"clínicas dentales en Valencia\nfisioterapeutas en Madrid centro"}
          required
        />
        <p className="hint">Una búsqueda por línea, igual que la escribirías en Google Maps.</p>
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
