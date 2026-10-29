/** Solo direcciones de esta app ("/leads?x=1"), nunca de otro sitio ("//evil.com", "https://…"). */
export function safeNext(next: string | null | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}

/**
 * Navegación con recarga completa: tras entrar, salir o cambiar de cuenta, la
 * app debe arrancar de cero con los datos de la cuenta (sin estado de la anterior).
 */
export function hardNavigate(path: string) {
  window.location.assign(path);
}
