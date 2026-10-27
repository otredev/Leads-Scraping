import { defineExporter } from "@/core/exporter";

export default defineExporter({
  id: "json",
  label: "JSON",
  extension: "json",
  mimeType: "application/json; charset=utf-8",
  options: [],
  export(leads) {
    return JSON.stringify(leads, null, 2);
  },
});
