import type { Child } from "hono/jsx";
import type { PortalSite } from "../../src/core/portal";
import { Brand, fmt, Layout, LegalLinks } from "./pages";

/**
 * Páginas legales del portal: aviso legal (LSSI art. 10), privacidad (RGPD arts. 13 y 14)
 * y cookies. Se generan con los datos que rellenas en Ajustes → Portal del cliente.
 *
 * Son plantillas orientativas para España pensadas para lo que hace este portal
 * (sin cookies propias, sin analítica, alojado en Cloudflare). No son asesoramiento legal.
 */

export const LEGAL_PAGES = {
  "aviso-legal": "Aviso legal",
  privacidad: "Política de privacidad",
  cookies: "Política de cookies",
} as const;
export type LegalSlug = keyof typeof LEGAL_PAGES;

/** Valor o marca de "pendiente" si el titular aún no lo ha rellenado. */
function V({ value }: { value?: string }) {
  return value ? <>{value}</> : <span class="pending">pendiente de completar</span>;
}

function Section({ title, children }: { title: string; children: Child }) {
  return (
    <>
      <h2>{title}</h2>
      {children}
    </>
  );
}

function Identity({ site }: { site?: PortalSite }) {
  const l = site?.legal ?? {};
  const b = site?.brand;
  return (
    <dl>
      <dt>Titular</dt>
      <dd>
        <V value={l.holder} />
      </dd>
      {b && b.name !== l.holder && b.name !== "Portal de clientes" && (
        <>
          <dt>Nombre comercial</dt>
          <dd>{b.name}</dd>
        </>
      )}
      <dt>NIF / CIF</dt>
      <dd>
        <V value={l.taxId} />
      </dd>
      <dt>Domicilio</dt>
      <dd>
        <V value={l.address} />
      </dd>
      <dt>Email</dt>
      <dd>{b?.email ? <a href={`mailto:${b.email}`}>{b.email}</a> : <V />}</dd>
      {b?.phone && (
        <>
          <dt>Teléfono</dt>
          <dd>{b.phone}</dd>
        </>
      )}
      {l.registry && (
        <>
          <dt>Datos registrales</dt>
          <dd>{l.registry}</dd>
        </>
      )}
      {b?.website && (
        <>
          <dt>Web</dt>
          <dd>
            <a href={b.website} rel="noopener">
              {b.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
            </a>
          </dd>
        </>
      )}
    </dl>
  );
}

function contactLine(site?: PortalSite) {
  return site?.brand.email ? (
    <>
      escribiendo a <a href={`mailto:${site.brand.email}`}>{site.brand.email}</a>
    </>
  ) : (
    "a través de los datos de contacto indicados arriba"
  );
}

function AvisoLegal({ site }: { site?: PortalSite }) {
  const holder = site?.legal.holder ?? "el titular";
  return (
    <>
      <Section title="Datos identificativos">
        <p>En cumplimiento del artículo 10 de la Ley 34/2002, de servicios de la sociedad de la información y de comercio electrónico (LSSI), se informa de:</p>
        <Identity site={site} />
      </Section>
      <Section title="Objeto">
        <p>
          Este portal permite a los clientes de {holder} consultar el avance de los proyectos contratados: estado, cronograma, tareas y, cuando se indica, presupuesto y
          pagos. Cada cliente accede con un enlace personal.
        </p>
      </Section>
      <Section title="Uso del portal">
        <p>
          El enlace de acceso es personal: no lo compartas con terceros. Si crees que alguien más lo tiene, pide uno nuevo; el anterior dejará de funcionar. Queda
          prohibido usar el portal con fines ilícitos o que puedan dañar su funcionamiento.
        </p>
      </Section>
      <Section title="Contenido y responsabilidad">
        <p>
          La información del portal es orientativa y refleja el estado del proyecto en el momento de su última actualización. Las fechas previstas pueden cambiar; lo
          acordado en el contrato o presupuesto prevalece sobre lo mostrado aquí. El titular no se hace responsable de interrupciones del servicio ajenas a su control.
        </p>
      </Section>
      <Section title="Propiedad intelectual">
        <p>
          Los contenidos, el diseño y los materiales de los proyectos mostrados pertenecen a su titular o se usan con autorización. Su uso fuera de este portal se rige
          por lo acordado entre las partes.
        </p>
      </Section>
      <Section title="Legislación aplicable">
        <p>Este aviso legal se rige por la legislación española.</p>
      </Section>
    </>
  );
}

function Privacidad({ site }: { site?: PortalSite }) {
  return (
    <>
      <Section title="Responsable del tratamiento">
        <Identity site={site} />
      </Section>
      <Section title="Qué datos tratamos">
        <ul>
          <li>Tus datos de cliente: nombre o razón social y persona de contacto.</li>
          <li>La información de tus proyectos: estado, hitos, tareas y, si se muestran, presupuesto y pagos.</li>
          <li>Del uso del portal: la fecha de tu última visita y el número de visitas.</li>
          <li>Los mensajes que nos envías desde el portal y nuestras respuestas.</li>
          <li>
            El registro de tu aceptación de estas condiciones y de las propuestas o contratos que aceptes: el nombre que escribes, la fecha y hora, la dirección IP y el
            navegador.
          </li>
          <li>Datos técnicos de la conexión (dirección IP, navegador), que trata el proveedor de alojamiento para servir la web y protegerla.</li>
        </ul>
        <p>Los datos los facilitas tú al contratar o se generan durante el proyecto.</p>
      </Section>
      <Section title="Para qué y con qué base legal">
        <ul>
          <li>
            Informarte del avance del proyecto contratado: ejecución del contrato (art. 6.1.b del RGPD).
          </li>
          <li>Atender tus mensajes y consultas sobre el proyecto: ejecución del contrato (art. 6.1.b del RGPD).</li>
          <li>Poder demostrar que aceptaste estas condiciones o un documento: interés legítimo del responsable (art. 6.1.f del RGPD).</li>
          <li>Mantener el portal seguro y evitar abusos: interés legítimo del responsable (art. 6.1.f del RGPD).</li>
        </ul>
        <p>No se toman decisiones automatizadas ni se elaboran perfiles con estos datos.</p>
      </Section>
      <Section title="Quién más accede a los datos">
        <p>
          El portal está alojado en Cloudflare, Inc., que actúa como encargado del tratamiento. Algunos datos pueden tratarse fuera del Espacio Económico Europeo; esas
          transferencias se amparan en el Marco de Privacidad de Datos UE-EE. UU. y en las cláusulas contractuales tipo de la Comisión Europea. No se ceden datos a
          terceros salvo obligación legal.
        </p>
      </Section>
      <Section title="Cuánto tiempo">
        <p>
          Mientras dure la relación con el cliente. Al terminar, el enlace se desactiva y la información del portal se borra; los datos que deban conservarse por
          obligaciones legales (por ejemplo, fiscales) se guardan el tiempo exigido.
        </p>
      </Section>
      <Section title="Tus derechos">
        <p>
          Puedes pedir el acceso, la rectificación o la supresión de tus datos, la limitación u oposición a su tratamiento y su portabilidad {contactLine(site)}. Si
          consideras que no se han atendido correctamente, puedes reclamar ante la Agencia Española de Protección de Datos (
          <a href="https://www.aepd.es" rel="noopener">
            aepd.es
          </a>
          ).
        </p>
      </Section>
    </>
  );
}

function Cookies({ site }: { site?: PortalSite }) {
  return (
    <>
      <Section title="Este portal no usa cookies propias">
        <p>
          El portal no instala cookies propias ni de terceros con fines analíticos, publicitarios o de personalización, y no guarda información en tu navegador. Por
          eso no te pide consentimiento.
        </p>
      </Section>
      <Section title="Cookies técnicas del alojamiento">
        <p>
          El proveedor de alojamiento, Cloudflare, puede instalar cookies técnicas estrictamente necesarias para la seguridad del servicio, como <code>__cf_bm</code>,
          que distingue el tráfico de personas del de bots y dura unos 30 minutos. Estas cookies están exentas de consentimiento (art. 22.2 de la LSSI).
        </p>
      </Section>
      <Section title="Cómo gestionarlas">
        <p>Puedes borrar o bloquear las cookies desde la configuración de tu navegador; si bloqueas las de seguridad, es posible que el portal no cargue bien.</p>
        <p>Si tienes dudas, puedes contactar {contactLine(site)}.</p>
      </Section>
    </>
  );
}

/**
 * Versión de los textos legales: cambia si cambian tus datos legales o los de contacto,
 * y entonces se vuelve a pedir la aceptación a los clientes.
 */
export async function policyVersion(site?: PortalSite) {
  const text = JSON.stringify({ legal: site?.legal ?? {}, name: site?.brand.name ?? "", email: site?.brand.email ?? "" });
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)]
    .slice(0, 6)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function LegalPage({ page, site, token }: { page: LegalSlug; site?: PortalSite; token?: string }) {
  const title = LEGAL_PAGES[page];
  const brand = site?.brand.name;
  const updated = site ? fmt(site.timeZone, { day: "numeric", month: "long", year: "numeric" }).format(new Date(site.updatedAt)) : undefined;
  const incomplete = !site?.legal.holder || !site.legal.taxId || !site.legal.address || !site.brand.email;
  return (
    <Layout title={title} brand={brand}>
      {(brand || token) && (
        <header class="top">
          {brand ? <Brand name={brand} token={token} /> : <span />}
          {token && (
            <a class="back" href={`/p/${token}`}>
              ← Volver al portal
            </a>
          )}
        </header>
      )}
      <main>
        <article class="card legal">
          <h1>{title}</h1>
          {updated && <p class="muted small">Última actualización: {updated}</p>}
          {incomplete && <p class="callout">El titular aún no ha completado todos sus datos legales. Si los necesitas, pídeselos directamente.</p>}
          {page === "aviso-legal" ? <AvisoLegal site={site} /> : page === "privacidad" ? <Privacidad site={site} /> : <Cookies site={site} />}
        </article>
      </main>
      <footer class="foot">
        <LegalLinks token={token} current={page} />
      </footer>
    </Layout>
  );
}
