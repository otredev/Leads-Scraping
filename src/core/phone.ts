import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

/**
 * Normaliza teléfonos a formato internacional.
 * Los números que ya traen prefijo (+34…) se respetan; los nacionales se
 * interpretan con el país indicado (el de la búsqueda o DEFAULT_COUNTRY).
 */
export function normalizePhone(raw: string | undefined, country?: string) {
  if (!raw?.trim()) return undefined;
  const parsed = parsePhoneNumberFromString(raw, (country?.toUpperCase() || undefined) as CountryCode | undefined);
  if (!parsed || !parsed.isPossible()) return { display: raw.trim(), e164: undefined };
  return { display: parsed.formatInternational(), e164: parsed.number as string };
}

/** Aplica la normalización a un lead (sin tocar el resto de campos). */
export function withNormalizedPhone<T extends { phone?: string; phoneE164?: string }>(lead: T, country?: string): T {
  if (lead.phoneE164 || !lead.phone) return lead;
  const n = normalizePhone(lead.phone, country);
  return n ? { ...lead, phone: n.display, phoneE164: n.e164 } : lead;
}
