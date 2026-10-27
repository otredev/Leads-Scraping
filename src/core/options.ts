/**
 * Esquema declarativo de opciones. Proveedores y exportadores describen sus
 * opciones con esto y la UI genera el formulario automáticamente.
 */

interface BaseField {
  key: string;
  label: string;
  help?: string;
}

export type OptionField =
  | (BaseField & { type: "boolean"; default: boolean })
  | (BaseField & { type: "number"; default: number; min?: number; max?: number; step?: number })
  | (BaseField & { type: "text"; default: string; placeholder?: string })
  | (BaseField & {
      type: "select";
      default: string;
      choices: { value: string; label: string }[];
    });

export type OptionValues = Record<string, string | number | boolean>;

export function defaultOptions(fields: OptionField[]): OptionValues {
  return Object.fromEntries(fields.map((f) => [f.key, f.default]));
}

/** Valida y normaliza valores recibidos (p. ej. del formulario) contra el esquema. */
export function resolveOptions(fields: OptionField[], input: unknown): OptionValues {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: OptionValues = {};
  for (const f of fields) {
    const v = raw[f.key];
    switch (f.type) {
      case "boolean":
        out[f.key] = typeof v === "boolean" ? v : v === "true" ? true : v === "false" ? false : f.default;
        break;
      case "number": {
        let n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
        if (!Number.isFinite(n)) n = f.default;
        if (f.min !== undefined) n = Math.max(f.min, n);
        if (f.max !== undefined) n = Math.min(f.max, n);
        out[f.key] = n;
        break;
      }
      case "text":
        out[f.key] = typeof v === "string" ? v : f.default;
        break;
      case "select":
        out[f.key] =
          typeof v === "string" && f.choices.some((c) => c.value === v) ? v : f.default;
        break;
    }
  }
  return out;
}
