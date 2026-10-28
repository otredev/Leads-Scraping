/**
 * Documentos: propuestas, contratos y facturas, con plantillas.
 *
 * - El texto de cada documento es Markdown con variables ({cliente.nombre},
 *   {proyecto.hitos}…). Mientras es borrador, las variables se rellenan con los
 *   datos actuales del cliente y del proyecto; al enviarlo (o emitir la
 *   factura) se congela el texto y los datos de las partes.
 * - Las facturas emitidas no se pueden cambiar: se corrigen con una
 *   rectificativa. Cada factura emitida genera un registro encadenado con la
 *   huella SHA-256 del formato de la AEAT (sistema "NO VERI*FACTU") y su QR.
 *
 * Código puro: lo usan la API, la página, el MCP y el portal.
 */

export const DOC_TYPES = [
  { id: "proposal", label: "Propuesta", plural: "Propuestas", prefix: "PRO" },
  { id: "contract", label: "Contrato", plural: "Contratos", prefix: "CON" },
  { id: "invoice", label: "Factura", plural: "Facturas", prefix: "F" },
] as const;
export type DocType = (typeof DOC_TYPES)[number]["id"];
export const docTypeLabel = (t: string) => DOC_TYPES.find((d) => d.id === t)?.label ?? t;

export const DOC_STATUSES = {
  draft: "Borrador",
  sent: "Enviado",
  accepted: "Aceptado",
  rejected: "Rechazado",
  issued: "Emitida",
  paid: "Pagada",
  rectified: "Rectificada",
  cancelled: "Cancelado",
} as const;
export type DocStatus = keyof typeof DOC_STATUSES;

/** Estados posibles por tipo (en orden de flujo). */
export const STATUSES_BY_TYPE: Record<DocType, DocStatus[]> = {
  proposal: ["draft", "sent", "accepted", "rejected"],
  contract: ["draft", "sent", "accepted", "cancelled"],
  invoice: ["draft", "issued", "paid", "rectified"],
};

export function statusLabel(type: DocType, status: DocStatus) {
  if (type === "contract" && status === "accepted") return "Firmado";
  if (type === "proposal" && status === "accepted") return "Aceptada";
  if (type === "proposal" && status === "rejected") return "Rechazada";
  if (type === "proposal" && status === "sent") return "Enviada";
  return DOC_STATUSES[status];
}

/** Tipos de factura de la AEAT: F1 completa, R4 rectificativa (resto de casos). */
export type InvoiceKind = "F1" | "R4";

export interface DocLine {
  description: string;
  quantity: number;
  unitPrice: number;
  /** IVA en % (21, 10, 4, 0). */
  vat: number;
}

/** Datos de una parte (emisor o cliente), congelados al enviar o emitir. */
export interface Party {
  name: string;
  /** Nombre comercial (emisor) o persona de contacto (cliente). */
  tradeName?: string;
  taxId?: string;
  address?: string;
  email?: string;
  phone?: string;
  website?: string;
}

/** Registro de facturación encadenado (formato de huella de la AEAT). */
export interface InvoiceRecord {
  /** Huella SHA-256 en hexadecimal mayúsculas. */
  hash: string;
  /** Huella del registro anterior ("" en el primero). */
  prevHash: string;
  /** FechaHoraHusoGenRegistro: AAAA-MM-DDThh:mm:ss+hh:mm */
  generatedAt: string;
  /** Texto exacto sobre el que se calculó la huella (para auditoría). */
  input: string;
  qrUrl: string;
}

export interface Acceptance {
  name: string;
  at: string;
  /** "portal" si lo aceptó el cliente; "manual" si lo marcaste tú. */
  via: "portal" | "manual";
  ip?: string;
  userAgent?: string;
}

export interface Document {
  id: string;
  type: DocType;
  clientId: string;
  projectId?: string;
  templateId?: string;
  title: string;
  status: DocStatus;
  /** Número: PRO-2026-001, CON-2026-001 o, en facturas, al emitirlas (F2026-0001). */
  number?: string;
  /** Fecha del documento (AAAA-MM-DD). En facturas, la de expedición. */
  date: string;
  /** Propuestas: válida hasta. Facturas: vencimiento. */
  dueDate?: string;
  currency: string;
  /** Markdown con variables mientras es borrador; texto final después. */
  body: string;
  lines: DocLine[];
  /** Retención de IRPF en % (facturas de autónomos a empresas: 15 o 7). */
  irpf?: number;
  notes?: string;
  /** Mostrar en el portal del cliente (no aplica a borradores). */
  visibleToClient: boolean;
  /** Partes congeladas al enviar/emitir. */
  issuer?: Party;
  customer?: Party;
  sentAt?: string;
  acceptance?: Acceptance;
  rejectedAt?: string;
  // Facturas
  kind?: InvoiceKind;
  series?: string;
  sequence?: number;
  issuedAt?: string;
  record?: InvoiceRecord;
  paidAt?: string;
  /** Rectificativa: factura que corrige. */
  rectifies?: { id: string; number: string; date: string };
  /** Factura original: rectificativa que la corrige. */
  rectifiedBy?: { id: string; number: string };
  /** Documento del que se creó (propuesta → contrato/factura). */
  fromId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocTemplate {
  id: string;
  type: DocType;
  name: string;
  title: string;
  body: string;
  lines: DocLine[];
  /** Días de validez (propuestas) o de vencimiento (facturas). */
  days?: number;
  notes?: string;
  builtIn?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentSettings {
  /** IVA por defecto en %. */
  vat?: number;
  /** IRPF por defecto en % (vacío: sin retención). */
  irpf?: number;
  /** Cuenta para cobrar (aparece en las facturas). */
  iban?: string;
  /** Texto al pie de las facturas (forma de pago, inscripción…). */
  invoiceFooter?: string;
  /** Días para el vencimiento de las facturas. */
  paymentDays?: number;
}

// ── Importes ──

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface Totals {
  base: number;
  /** IVA agrupado por tipo. */
  vat: { rate: number; base: number; amount: number }[];
  vatTotal: number;
  irpf: number;
  /** Base + IVA (ImporteTotal de la AEAT). */
  gross: number;
  /** A pagar: base + IVA − IRPF. */
  total: number;
}

export function docTotals(d: Pick<Document, "lines" | "irpf">): Totals {
  const groups = new Map<number, number>();
  let base = 0;
  for (const l of d.lines) {
    const amount = r2(l.quantity * l.unitPrice);
    base += amount;
    groups.set(l.vat, (groups.get(l.vat) ?? 0) + amount);
  }
  const vat = [...groups].map(([rate, b]) => ({ rate, base: r2(b), amount: r2((b * rate) / 100) })).sort((a, b) => b.rate - a.rate);
  const vatTotal = r2(vat.reduce((s, v) => s + v.amount, 0));
  base = r2(base);
  const irpf = d.irpf ? r2((base * d.irpf) / 100) : 0;
  return { base, vat, vatTotal, irpf, gross: r2(base + vatTotal), total: r2(base + vatTotal - irpf) };
}

export function formatAmount(n: number, currency = "EUR") {
  try {
    return new Intl.NumberFormat("es", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

// ── Variables ──

export interface DocContext {
  client: { name: string; contactName?: string; email?: string; phone?: string; address?: string; website?: string; taxId?: string; category?: string };
  project?: { name: string; description?: string; startDate?: string; dueDate?: string; budget?: number; hourlyRate?: number; currency: string; milestones: { title: string; dueAt?: string }[] };
  me: { brandName?: string; legalName?: string; taxId?: string; address?: string; email?: string; phone?: string; website?: string; iban?: string };
  doc: { number?: string; date: string; dueDate?: string; total?: number; currency: string };
  today: string;
}

const dayFmt = new Intl.DateTimeFormat("es", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
export const longDate = (d?: string) => (d ? dayFmt.format(new Date(`${d.slice(0, 10)}T12:00:00Z`)) : "");

/** Variables disponibles en plantillas, agrupadas para el selector. */
export const VARIABLES: { group: string; items: { key: string; label: string }[] }[] = [
  {
    group: "Cliente",
    items: [
      { key: "cliente.nombre", label: "Nombre o empresa" },
      { key: "cliente.contacto", label: "Persona de contacto" },
      { key: "cliente.nif", label: "NIF / CIF" },
      { key: "cliente.direccion", label: "Dirección" },
      { key: "cliente.email", label: "Email" },
      { key: "cliente.telefono", label: "Teléfono" },
      { key: "cliente.web", label: "Web" },
      { key: "cliente.sector", label: "Sector" },
    ],
  },
  {
    group: "Proyecto",
    items: [
      { key: "proyecto.nombre", label: "Nombre" },
      { key: "proyecto.descripcion", label: "Descripción" },
      { key: "proyecto.inicio", label: "Fecha de inicio" },
      { key: "proyecto.entrega", label: "Fecha de entrega" },
      { key: "proyecto.presupuesto", label: "Presupuesto" },
      { key: "proyecto.precio_hora", label: "Precio por hora" },
      { key: "proyecto.hitos", label: "Hitos (lista)" },
    ],
  },
  {
    group: "Tus datos",
    items: [
      { key: "yo.nombre", label: "Nombre comercial" },
      { key: "yo.titular", label: "Titular" },
      { key: "yo.nif", label: "NIF / CIF" },
      { key: "yo.direccion", label: "Domicilio" },
      { key: "yo.email", label: "Email" },
      { key: "yo.telefono", label: "Teléfono" },
      { key: "yo.web", label: "Web" },
      { key: "yo.iban", label: "IBAN" },
    ],
  },
  {
    group: "Documento",
    items: [
      { key: "documento.numero", label: "Número" },
      { key: "documento.fecha", label: "Fecha" },
      { key: "documento.validez", label: "Válido hasta / vencimiento" },
      { key: "documento.total", label: "Total" },
      { key: "hoy", label: "Fecha de hoy" },
    ],
  },
];

export function variableValues(c: DocContext): Record<string, string> {
  const money = (n?: number, cur = c.doc.currency) => (n === undefined ? "" : formatAmount(n, cur));
  const p = c.project;
  return {
    "cliente.nombre": c.client.name,
    "cliente.contacto": c.client.contactName ?? c.client.name,
    "cliente.nif": c.client.taxId ?? "",
    "cliente.direccion": c.client.address ?? "",
    "cliente.email": c.client.email ?? "",
    "cliente.telefono": c.client.phone ?? "",
    "cliente.web": c.client.website?.replace(/^https?:\/\//, "").replace(/\/$/, "") ?? "",
    "cliente.sector": c.client.category ?? "",
    "proyecto.nombre": p?.name ?? "",
    "proyecto.descripcion": p?.description ?? "",
    "proyecto.inicio": longDate(p?.startDate),
    "proyecto.entrega": longDate(p?.dueDate),
    "proyecto.presupuesto": money(p?.budget, p?.currency),
    "proyecto.precio_hora": money(p?.hourlyRate, p?.currency),
    "proyecto.hitos": p?.milestones.length ? p.milestones.map((m) => `- ${m.title}${m.dueAt ? `: ${longDate(m.dueAt)}` : ""}`).join("\n") : "",
    "yo.nombre": c.me.brandName ?? c.me.legalName ?? "",
    "yo.titular": c.me.legalName ?? c.me.brandName ?? "",
    "yo.nif": c.me.taxId ?? "",
    "yo.direccion": c.me.address ?? "",
    "yo.email": c.me.email ?? "",
    "yo.telefono": c.me.phone ?? "",
    "yo.web": c.me.website?.replace(/^https?:\/\//, "").replace(/\/$/, "") ?? "",
    "yo.iban": c.me.iban ?? "",
    "documento.numero": c.doc.number ?? "",
    "documento.fecha": longDate(c.doc.date),
    "documento.validez": longDate(c.doc.dueDate),
    "documento.total": money(c.doc.total),
    hoy: longDate(c.today),
  };
}

/** Sustituye {variable} por su valor. Las desconocidas se dejan tal cual; las vacías, como "[variable]" para verlas. */
export function renderVariables(text: string, values: Record<string, string>): string {
  return text.replace(/\{([a-z_]+(?:\.[a-z_]+)?)\}/g, (all, key: string) => {
    if (!(key in values)) return all;
    return values[key] || `[${key}]`;
  });
}

/** Variables sin dato en el texto (para avisar antes de enviar). */
export function missingVariables(text: string, values: Record<string, string>): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/\{([a-z_]+(?:\.[a-z_]+)?)\}/g)) if (m[1] in values && !values[m[1]]) out.add(m[1]);
  return [...out];
}

// ── Numeración ──

export const yearOf = (date: string) => date.slice(0, 4);
/** Serie de facturas por año: F2026- y R2026- (rectificativas). */
export const invoiceSeries = (kind: InvoiceKind, date: string) => `${kind === "R4" ? "R" : "F"}${yearOf(date)}-`;
export const formatNumber = (series: string, seq: number, width = 4) => `${series}${String(seq).padStart(width, "0")}`;

// ── Registro de facturación (huella y QR de la AEAT) ──

/** Fecha AAAA-MM-DD → DD-MM-AAAA (formato de la AEAT). */
export const aeatDate = (d: string) => `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}`;
const aeatAmount = (n: number) => n.toFixed(2);

/** Fecha y hora local con huso: 2026-10-28T18:39:05+01:00 */
export function localDateTimeWithOffset(date = new Date()): string {
  const pad = (n: number) => String(Math.abs(n)).padStart(2, "0");
  const off = -date.getTimezoneOffset();
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${off >= 0 ? "+" : "-"}${pad(Math.trunc(off / 60))}:${pad(off % 60)}`;
}

/**
 * Texto de la huella de un registro de alta, según la especificación de la AEAT:
 * pares nombre=valor unidos por "&", sin espacios alrededor de los valores.
 */
export function recordHashInput(r: {
  issuerTaxId: string;
  number: string;
  date: string;
  kind: InvoiceKind;
  vatTotal: number;
  gross: number;
  prevHash: string;
  generatedAt: string;
}): string {
  return [
    `IDEmisorFactura=${r.issuerTaxId.trim()}`,
    `NumSerieFactura=${r.number.trim()}`,
    `FechaExpedicionFactura=${aeatDate(r.date)}`,
    `TipoFactura=${r.kind}`,
    `CuotaTotal=${aeatAmount(r.vatTotal)}`,
    `ImporteTotal=${aeatAmount(r.gross)}`,
    `Huella=${r.prevHash.trim()}`,
    `FechaHoraHusoGenRegistro=${r.generatedAt}`,
  ].join("&");
}

/** URL del QR tributario (sistema NO VERI*FACTU: no se envían los registros a la AEAT). */
export function taxQrUrl(r: { issuerTaxId: string; number: string; date: string; gross: number }, opts: { verifactu?: boolean; test?: boolean } = {}) {
  const host = opts.test ? "https://prewww2.aeat.es" : "https://www2.agenciatributaria.gob.es";
  const path = opts.verifactu ? "/wlpl/TIKE-CONT/ValidarQR" : "/wlpl/TIKE-CONT/ValidarQRNoVerifactu";
  const q = new URLSearchParams({ nif: r.issuerTaxId.trim(), numserie: r.number.trim(), fecha: aeatDate(r.date), importe: aeatAmount(r.gross) });
  return `${host}${path}?${q.toString()}`;
}

// ── Plantillas incluidas ──

export const BUILT_IN_TEMPLATES: Omit<DocTemplate, "createdAt" | "updatedAt">[] = [
  {
    id: "builtin-proposal-web",
    type: "proposal",
    name: "Propuesta de proyecto",
    title: "Propuesta: {proyecto.nombre}",
    days: 15,
    builtIn: true,
    lines: [],
    body: `Hola {cliente.contacto}:

Gracias por tu interés. Esta es nuestra propuesta para **{proyecto.nombre}**.

## Qué haremos

{proyecto.descripcion}

## Plan de trabajo

{proyecto.hitos}

Entrega prevista: **{proyecto.entrega}**.

## Inversión

El detalle está en la tabla de importes. Forma de pago: 50 % al aceptar la propuesta y 50 % a la entrega.

## Siguientes pasos

Si te encaja, acepta la propuesta y empezamos. Esta propuesta es válida hasta el {documento.validez}.

Un saludo,
{yo.titular}
{yo.nombre} · {yo.email} · {yo.telefono}`,
  },
  {
    id: "builtin-contract-services",
    type: "contract",
    name: "Contrato de prestación de servicios",
    title: "Contrato de servicios: {proyecto.nombre}",
    builtIn: true,
    lines: [],
    body: `En la fecha {documento.fecha}, de una parte **{yo.titular}**, con NIF {yo.nif} y domicilio en {yo.direccion} (en adelante, el PRESTADOR), y de otra **{cliente.nombre}**, con NIF {cliente.nif} y domicilio en {cliente.direccion} (en adelante, el CLIENTE), acuerdan:

## 1. Objeto

El PRESTADOR realizará para el CLIENTE el proyecto **{proyecto.nombre}**: {proyecto.descripcion}

## 2. Plazos

El trabajo comenzará el {proyecto.inicio} y la entrega prevista es el {proyecto.entrega}, según este calendario:

{proyecto.hitos}

Los plazos pueden ajustarse si el CLIENTE no aporta a tiempo los contenidos o aprobaciones necesarios.

## 3. Precio y pago

El precio total es de **{proyecto.presupuesto}** (impuestos no incluidos), pagadero un 50 % a la firma y un 50 % a la entrega, mediante transferencia a {yo.iban}.

## 4. Cambios

Las peticiones fuera del alcance descrito se presupuestarán aparte.

## 5. Propiedad intelectual

Una vez pagado el precio total, el CLIENTE podrá usar libremente los entregables. El PRESTADOR podrá mostrarlos en su portfolio salvo que se acuerde lo contrario.

## 6. Confidencialidad y datos

Ambas partes guardarán confidencialidad sobre la información que intercambien. Si el PRESTADOR trata datos personales por cuenta del CLIENTE, lo hará solo para prestar el servicio y conforme al RGPD.

## 7. Resolución

Cualquiera de las partes puede resolver el contrato por incumplimiento de la otra. Si el CLIENTE cancela, abonará el trabajo realizado hasta la fecha.

## 8. Ley aplicable

Este contrato se rige por la legislación española.

Firmado electrónicamente por ambas partes.`,
  },
  {
    id: "builtin-invoice",
    type: "invoice",
    name: "Factura",
    title: "Factura {proyecto.nombre}",
    days: 30,
    builtIn: true,
    lines: [],
    body: "",
  },
];
