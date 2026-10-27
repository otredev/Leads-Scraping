"use client";

import { useState } from "react";
import { Mail, MessageCircle, Plus, Trash2 } from "lucide-react";
import type { CrmSettings, MessageTemplate, TemplateChannel } from "@/core/crm";
import type { Lead } from "@/core/lead";
import { TEMPLATE_VARS, renderTemplate } from "@/core/templates";
import { useData } from "../data/DataProvider";
import { Card, Notice } from "../ui";

type Draft = Omit<MessageTemplate, "id"> & { id?: string };

const SAMPLE: Lead = {
  id: "ejemplo",
  searchId: "",
  sourceId: "",
  providerId: "",
  name: "Clínica Dental Sonrisa",
  category: "Dentista",
  emails: ["hola@sonrisa.es"],
  phone: "+34 963 00 00 00",
  website: "https://sonrisa.es",
  address: "Calle Mayor 12, Valencia",
  rating: 4.7,
  reviewCount: 128,
  reviews: [],
  extra: {},
  collectedAt: "",
};

/** Plantillas de WhatsApp y email con variables como {nombre} o {categoria}. */
export function TemplatesCard({ settings }: { settings: CrmSettings }) {
  const { patchSettings } = useData();
  const [list, setList] = useState<Draft[]>(settings.templates);
  const [open, setOpen] = useState<number | undefined>(settings.templates.length ? undefined : 0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone?: "error" }>();
  const dirty = JSON.stringify(list) !== JSON.stringify(settings.templates);

  const edit = (i: number, patch: Partial<Draft>) => setList((l) => l.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  async function save() {
    setBusy(true);
    setNotice(undefined);
    try {
      const next = await patchSettings({ templates: list });
      setList(next.templates);
      setNotice({ text: "Plantillas guardadas." });
    } catch (err) {
      setNotice({ text: (err as Error).message, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title="Plantillas de mensaje" description="Para WhatsApp y email desde la ficha de cada lead">
      <div className="flex flex-col gap-4">
        {notice && (
          <Notice tone={notice.tone} onClose={() => setNotice(undefined)}>
            {notice.text}
          </Notice>
        )}
        <p className="hint">
          Variables:{" "}
          {TEMPLATE_VARS.map((v, i) => (
            <span key={v.key}>
              <code className="rounded bg-surface-2 px-1 text-[12px] text-fg-2" title={v.label}>
                {`{${v.key}}`}
              </code>
              {i < TEMPLATE_VARS.length - 1 ? " " : ""}
            </span>
          ))}
        </p>

        <ul className="flex flex-col gap-2">
          {list.map((t, i) => {
            const Icon = t.channel === "email" ? Mail : MessageCircle;
            const isOpen = open === i;
            return (
              <li key={t.id ?? `new-${i}`} className="rounded-xl border border-line">
                <div className="flex items-center gap-2 px-3 py-2">
                  <button className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm" onClick={() => setOpen(isOpen ? undefined : i)} aria-expanded={isOpen}>
                    <Icon className="size-4 shrink-0 text-muted" aria-hidden />
                    <span className="truncate font-medium">{t.name || "Sin nombre"}</span>
                    <span className="text-xs text-muted">{t.channel === "email" ? "Email" : "WhatsApp"}</span>
                  </button>
                  <button
                    className="btn btn-ghost size-8 p-0 text-muted hover:text-danger"
                    onClick={() => {
                      setList((l) => l.filter((_, j) => j !== i));
                      setOpen(undefined);
                    }}
                    aria-label={`Borrar plantilla ${t.name}`}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
                {isOpen && (
                  <div className="grid grid-cols-1 gap-4 border-t border-line p-3 lg:grid-cols-2">
                    <div className="flex flex-col gap-3">
                      <div className="grid grid-cols-[1fr_auto] gap-2">
                        <input className="input" value={t.name} onChange={(e) => edit(i, { name: e.target.value })} placeholder="Nombre" aria-label="Nombre de la plantilla" maxLength={40} />
                        <select className="input w-auto" value={t.channel} onChange={(e) => edit(i, { channel: e.target.value as TemplateChannel })} aria-label="Canal">
                          <option value="whatsapp">WhatsApp</option>
                          <option value="email">Email</option>
                        </select>
                      </div>
                      {t.channel === "email" && (
                        <input className="input" value={t.subject ?? ""} onChange={(e) => edit(i, { subject: e.target.value })} placeholder="Asunto" aria-label="Asunto" />
                      )}
                      <textarea
                        className="input min-h-36 resize-y"
                        value={t.body}
                        onChange={(e) => edit(i, { body: e.target.value })}
                        placeholder="Hola {nombre}, …"
                        aria-label="Texto de la plantilla"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <span className="label">Vista previa (lead de ejemplo)</span>
                      <div className="rounded-lg bg-surface-2 p-3 text-[13px] whitespace-pre-wrap text-fg-2">
                        {t.channel === "email" && t.subject && <p className="mb-2 font-medium text-fg">{renderTemplate(t.subject, SAMPLE, settings)}</p>}
                        {renderTemplate(t.body, SAMPLE, settings) || <span className="text-muted">Escribe el texto…</span>}
                      </div>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap gap-2">
          <button
            className="btn btn-sm"
            onClick={() => {
              setList((l) => [...l, { name: "Nueva plantilla", channel: "whatsapp", body: "Hola {nombre}, " }]);
              setOpen(list.length);
            }}
          >
            <Plus className="size-3.5" aria-hidden /> Añadir plantilla
          </button>
          <button className="btn btn-primary btn-sm" disabled={busy || !dirty || list.some((t) => !t.name.trim() || !t.body.trim())} onClick={save}>
            Guardar plantillas
          </button>
          {dirty && (
            <button className="btn btn-sm" onClick={() => setList(settings.templates)}>
              Descartar
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}
