import "server-only";

/** País por defecto para teléfonos sin prefijo internacional (DEFAULT_COUNTRY). */
export function defaultCountry() {
  return (process.env.DEFAULT_COUNTRY || "ES").toUpperCase();
}
