import type { Lead, SavedLead } from "./lead";
import type { CrmSettings, MessageTemplate } from "./crm";

/** Variables disponibles en las plantillas. */
export const TEMPLATE_VARS: { key: string; label: string; value(l: Lead, s?: CrmSettings): string }[] = [
  { key: "nombre", label: "Nombre del negocio", value: (l) => l.name },
  { key: "categoria", label: "Categoría", value: (l) => l.category ?? "" },
  { key: "direccion", label: "Dirección", value: (l) => l.address ?? "" },
  { key: "telefono", label: "Teléfono", value: (l) => l.phone ?? "" },
  { key: "email", label: "Email", value: (l) => l.emails[0] ?? "" },
  { key: "web", label: "Web", value: (l) => l.website ?? "" },
  {
    key: "valoracion",
    label: "Valoración",
    value: (l) => (l.rating !== undefined ? l.rating.toLocaleString("es", { maximumFractionDigits: 1 }) : ""),
  },
  { key: "resenas", label: "Nº de reseñas", value: (l) => (l.reviewCount !== undefined ? String(l.reviewCount) : "") },
  {
    key: "etapa",
    label: "Etapa",
    value: (l, s) => s?.stages.find((st) => st.id === (l as Partial<SavedLead>).stage)?.name ?? "",
  },
];

/** Sustituye {variable} por los datos del lead. Las desconocidas se dejan tal cual. */
export function renderTemplate(text: string, lead: Lead, settings?: CrmSettings): string {
  return text.replace(/\{([a-zñáéíóú_]+)\}/gi, (m, key: string) => {
    const v = TEMPLATE_VARS.find((x) => x.key === key.toLowerCase());
    return v ? v.value(lead, settings) : m;
  });
}

/** Solo dígitos, como pide wa.me. */
export function whatsappNumber(lead: Pick<Lead, "phone" | "phoneE164">): string | undefined {
  const digits = (lead.phoneE164 ?? lead.phone ?? "").replace(/\D/g, "");
  return digits.length >= 8 ? digits : undefined;
}

export function whatsappLink(lead: Lead, template?: MessageTemplate, settings?: CrmSettings): string | undefined {
  const n = whatsappNumber(lead);
  if (!n) return undefined;
  const text = template ? renderTemplate(template.body, lead, settings) : "";
  return `https://wa.me/${n}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

export function mailtoLink(lead: Lead, template?: MessageTemplate, settings?: CrmSettings): string | undefined {
  const to = lead.emails[0];
  if (!to) return undefined;
  const p = new URLSearchParams();
  if (template?.subject) p.set("subject", renderTemplate(template.subject, lead, settings));
  if (template) p.set("body", renderTemplate(template.body, lead, settings));
  // URLSearchParams usa "+" para espacios; los clientes de correo esperan %20.
  const qs = p.toString().replace(/\+/g, "%20");
  return `mailto:${to}${qs ? `?${qs}` : ""}`;
}
