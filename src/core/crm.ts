/**
 * CRM: etapas, etiquetas, colores, notas, "no contactar" y preferencias de
 * tablas. Código puro (cliente y servidor).
 */

/** Colores de etiqueta. Siempre van acompañados de un nombre (nunca solo color). */
export const LABEL_COLORS = [
  { id: "gray", name: "Gris" },
  { id: "blue", name: "Azul" },
  { id: "orange", name: "Naranja" },
  { id: "aqua", name: "Turquesa" },
  { id: "yellow", name: "Amarillo" },
  { id: "magenta", name: "Rosa" },
  { id: "green", name: "Verde" },
  { id: "violet", name: "Violeta" },
  { id: "red", name: "Rojo" },
] as const;

export type LabelColor = (typeof LABEL_COLORS)[number]["id"];

export function isLabelColor(v: unknown): v is LabelColor {
  return LABEL_COLORS.some((c) => c.id === v);
}

export interface Stage {
  id: string;
  name: string;
  color: LabelColor;
}

export interface Tag {
  id: string;
  name: string;
  color: LabelColor;
}

export interface Note {
  id: string;
  text: string;
  createdAt: string;
  updatedAt?: string;
}

export interface DoNotContact {
  at: string;
  reason?: string;
}

/** Campos que el usuario gestiona sobre un lead guardado. */
export interface CrmFields {
  stage: string;
  tags: string[];
  color?: LabelColor;
  notes: Note[];
  doNotContact?: DoNotContact;
}

// ── Preferencias de tabla (filtros predeterminados y columnas) ──

import type { LeadFilters, LeadSort } from "./query";

export type TableId = "results" | "saved";

export interface TablePrefs {
  filters: LeadFilters;
  sort?: LeadSort;
  /** Columnas visibles, en orden. */
  columns: string[];
  /** Ancho de columna en px (las que el usuario ha ajustado). */
  widths?: Record<string, number>;
}

export interface CrmSettings {
  stages: Stage[];
  tags: Tag[];
  /** Valoración por debajo de la cual se marca "Valoración baja". */
  lowRating: number;
  tables: Partial<Record<TableId, TablePrefs>>;
}

export const DEFAULT_STAGES: Stage[] = [
  { id: "desinteresado", name: "Desinteresados", color: "gray" },
  { id: "lead", name: "Leads", color: "blue" },
  { id: "interesado", name: "Interesados", color: "yellow" },
  { id: "cliente", name: "Clientes", color: "green" },
];

/** Etapa en la que entra un lead al guardarse. */
export const DEFAULT_STAGE_ID = "lead";

export const DEFAULT_SETTINGS: CrmSettings = {
  stages: DEFAULT_STAGES,
  tags: [],
  lowRating: 3.5,
  tables: {},
};

export function withDefaults(s: Partial<CrmSettings> | undefined): CrmSettings {
  return {
    stages: s?.stages?.length ? s.stages : DEFAULT_SETTINGS.stages,
    tags: s?.tags ?? [],
    lowRating: typeof s?.lowRating === "number" ? s.lowRating : DEFAULT_SETTINGS.lowRating,
    tables: s?.tables ?? {},
  };
}

/** Etapa inicial: "lead" si existe, si no la segunda (o la primera). */
export function initialStage(settings: CrmSettings): string {
  return (
    settings.stages.find((s) => s.id === DEFAULT_STAGE_ID)?.id ??
    settings.stages[1]?.id ??
    settings.stages[0]?.id ??
    DEFAULT_STAGE_ID
  );
}

export function slugId(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return base || "x";
}

/** Genera un id único a partir de un nombre. */
export function uniqueId(name: string, taken: Iterable<string>): string {
  const set = new Set(taken);
  const base = slugId(name);
  if (!set.has(base)) return base;
  let i = 2;
  while (set.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

// ── Actualizaciones de leads (individuales o masivas) ──

export interface LeadUpdate {
  stage?: string;
  /** null quita el color. */
  color?: LabelColor | null;
  addTags?: string[];
  removeTags?: string[];
  /** true/razón marca "no contactar"; false lo quita. */
  doNotContact?: boolean | string;
  addNote?: string;
  updateNote?: { id: string; text: string };
  deleteNote?: string;
}

/** Aplica una actualización en memoria (usado por json-file y por la UI optimista). */
export function applyLeadUpdate<T extends CrmFields>(lead: T, u: LeadUpdate, now: string, newId: () => string): T {
  const next: T = { ...lead, tags: [...(lead.tags ?? [])], notes: [...(lead.notes ?? [])] };
  if (u.stage) next.stage = u.stage;
  if (u.color === null) delete next.color;
  else if (u.color) next.color = u.color;
  if (u.addTags?.length) next.tags = [...new Set([...next.tags, ...u.addTags])];
  if (u.removeTags?.length) next.tags = next.tags.filter((t) => !u.removeTags!.includes(t));
  if (u.doNotContact === false) delete next.doNotContact;
  else if (u.doNotContact) {
    next.doNotContact = { at: now, ...(typeof u.doNotContact === "string" && u.doNotContact.trim() ? { reason: u.doNotContact.trim() } : {}) };
  }
  if (u.addNote?.trim()) next.notes = [{ id: newId(), text: u.addNote.trim(), createdAt: now }, ...next.notes];
  if (u.updateNote) {
    next.notes = next.notes.map((n) =>
      n.id === u.updateNote!.id ? { ...n, text: u.updateNote!.text.trim(), updatedAt: now } : n,
    );
  }
  if (u.deleteNote) next.notes = next.notes.filter((n) => n.id !== u.deleteNote);
  return next;
}

const invalid = (message: string) => Object.assign(new Error(message), { status: 400 });

/** Valida y limpia una actualización recibida por la API. */
export function sanitizeUpdate(raw: unknown, settings: CrmSettings): LeadUpdate {
  const r = (raw ?? {}) as Record<string, unknown>;
  const out: LeadUpdate = {};
  const tagIds = new Set(settings.tags.map((t) => t.id));
  const strArr = (v: unknown) => (Array.isArray(v) ? v.map(String).filter((t) => tagIds.has(t)) : undefined);
  if (typeof r.stage === "string") {
    if (!settings.stages.some((s) => s.id === r.stage)) throw invalid(`Etapa desconocida: ${r.stage}`);
    out.stage = r.stage;
  }
  if (r.color === null) out.color = null;
  else if (r.color !== undefined) {
    if (!isLabelColor(r.color)) throw invalid("Color no válido");
    out.color = r.color;
  }
  const add = strArr(r.addTags);
  if (add?.length) out.addTags = add;
  const rem = Array.isArray(r.removeTags) ? r.removeTags.map(String) : undefined;
  if (rem?.length) out.removeTags = rem;
  if (typeof r.doNotContact === "boolean" || typeof r.doNotContact === "string") out.doNotContact = r.doNotContact;
  if (typeof r.addNote === "string" && r.addNote.trim()) out.addNote = r.addNote.slice(0, 5000);
  const un = r.updateNote as { id?: unknown; text?: unknown } | undefined;
  if (un && typeof un.id === "string" && typeof un.text === "string" && un.text.trim()) {
    out.updateNote = { id: un.id, text: un.text.slice(0, 5000) };
  }
  if (typeof r.deleteNote === "string") out.deleteNote = r.deleteNote;
  return out;
}

/** Añade etapas y etiquetas que falten (por id), sin tocar las existentes. */
export function mergeSettings(current: CrmSettings, incoming: Partial<CrmSettings>): CrmSettings {
  const inc = withDefaults(incoming);
  const stageIds = new Set(current.stages.map((s) => s.id));
  const tagIds = new Set(current.tags.map((t) => t.id));
  return {
    ...current,
    stages: [...current.stages, ...inc.stages.filter((s) => !stageIds.has(s.id))],
    tags: [...current.tags, ...inc.tags.filter((t) => !tagIds.has(t.id))],
    tables: { ...inc.tables, ...current.tables },
  };
}
