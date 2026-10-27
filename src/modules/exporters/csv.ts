import { defineExporter } from "@/core/exporter";

function escape(value: string, delimiter: string): string {
  if (value.includes('"') || value.includes(delimiter) || /[\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export default defineExporter({
  id: "csv",
  label: "CSV",
  extension: "csv",
  mimeType: "text/csv; charset=utf-8",
  options: [
    {
      key: "delimiter",
      label: "Separador",
      type: "select",
      default: ",",
      choices: [
        { value: ",", label: "Coma (,)" },
        { value: ";", label: "Punto y coma (;) — Excel en español" },
      ],
    },
  ],
  export(leads, fields, options) {
    const d = String(options.delimiter);
    const lines = [fields.map((f) => escape(f.label, d)).join(d)];
    for (const lead of leads) {
      lines.push(fields.map((f) => escape(f.format(lead), d)).join(d));
    }
    // BOM para que Excel detecte UTF-8 (tildes y eñes).
    return "﻿" + lines.join("\r\n");
  },
});
