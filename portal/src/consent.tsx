import type { PortalSnapshot } from "../../src/core/portal";
import { Brand, Layout, LegalLinks } from "./pages";

/**
 * Antes de ver el portal, el cliente acepta el aviso legal y la política de
 * privacidad. Se guarda quién, cuándo, desde qué IP y con qué versión de los textos.
 */

const ERRORS: Record<string, string> = {
  nombre: "Escribe tu nombre completo.",
  casilla: "Marca la casilla para continuar.",
};

export function ConsentPage({ snap, token, next, error, updated }: { snap: PortalSnapshot; token: string; next: string; error?: string; updated?: boolean }) {
  const brand = snap.brand.name;
  const base = `/p/${token}/legal`;
  return (
    <Layout title="Antes de entrar" brand={brand}>
      <header class="top">
        <Brand name={brand} token={token} />
      </header>
      <main>
        <section class="card consent">
          <h1>{updated ? "Hemos actualizado nuestras condiciones" : `Hola, ${snap.client.contactName ?? snap.client.name}`}</h1>
          <p class="muted">
            {updated
              ? "Para seguir usando el portal, revisa y acepta las condiciones actualizadas."
              : `Este es tu portal privado con ${brand}: aquí verás el avance de tus proyectos, tus documentos y nuestros mensajes. Antes de entrar, revisa y acepta las condiciones de uso.`}
          </p>
          <ul class="consent-links">
            <li>
              <a href={`${base}/aviso-legal`}>Aviso legal</a> — quién somos y las condiciones de uso del portal.
            </li>
            <li>
              <a href={`${base}/privacidad`}>Política de privacidad</a> — qué datos tratamos, para qué y tus derechos.
            </li>
            <li>
              <a href={`${base}/cookies`}>Política de cookies</a> — este portal no usa cookies propias.
            </li>
          </ul>
          {error && ERRORS[error] && (
            <p class="callout err" role="alert">
              {ERRORS[error]}
            </p>
          )}
          <form method="post" action={`/p/${token}/consent`} class="accept">
            <input type="hidden" name="next" value={next} />
            <label>
              <span>Nombre y apellidos</span>
              <input name="name" required minlength={3} maxlength={120} autocomplete="name" />
            </label>
            <label class="check">
              <input type="checkbox" name="agree" value="1" required />
              <span>He leído y acepto el aviso legal y la política de privacidad de {brand}.</span>
            </label>
            <button class="btn primary" type="submit">
              Aceptar y entrar
            </button>
          </form>
          <p class="muted small">Guardaremos tu nombre, la fecha y hora y la dirección IP como registro de esta aceptación.</p>
        </section>
      </main>
      <footer class="foot">
        <LegalLinks token={token} />
      </footer>
    </Layout>
  );
}
