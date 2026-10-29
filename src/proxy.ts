import { NextResponse, type NextRequest } from "next/server";

/**
 * Sin sesión, las páginas de la app llevan a /login (y después vuelven).
 * Aquí solo se mira si existe la cookie: la sesión se comprueba de verdad en
 * cada petición a la API (server/http.ts), que responde 401 si no es válida.
 */

const PUBLIC_PAGES = ["/login", "/registro", "/recuperar"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();
  if (request.cookies.has("ls_session")) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Ni la API (responde 401 ella misma), ni archivos estáticos, iconos, manifiesto o service worker.
  matcher: ["/((?!api/|_next/|icons/|favicon\\.ico|manifest\\.webmanifest|sw\\.js|offline\\.html|robots\\.txt|.*\\.(?:png|svg|ico|jpg|webp|woff2?)$).*)"],
};
