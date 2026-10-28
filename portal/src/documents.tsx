import type { PortalDocument, PortalSnapshot } from "../../src/core/portal";
import { Contact, Footer, Header, Layout, day, money } from "./pages";

/* Propuestas, contratos y facturas en el portal del cliente. */

const amount = (n: number, currency: string) => {
  try {
    return new Intl.NumberFormat("es", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  } catch {
    return money(n, currency);
  }
};

function stateClass(doc: PortalDocument, accepted: boolean) {
  if (accepted || doc.status === "accepted" || doc.status === "paid") return "pill s-delivered";
  if (doc.acceptable) return "pill s-active";
  return "pill";
}

/** Lista en la página principal del cliente. */
export function DocumentsList({ snap, token }: { snap: PortalSnapshot; token: string }) {
  const docs = snap.documents ?? [];
  if (!docs.length) return null;
  const pending = docs.filter((d) => d.acceptable && !d.acceptance);
  return (
    <section class="card">
      <h2>
        Documentos {pending.length > 0 && <span class="count">{pending.length} por revisar</span>}
      </h2>
      <ul class="items">
        {docs.map((d) => (
          <li class="item doc-item">
            <a class="doc-link" href={`/p/${token}/d/${d.id}`}>
              <span>
                <span class="title">{d.title}</span>
                <span class="small muted">
                  {d.typeLabel}
                  {d.number ? ` ${d.number}` : ""} · {day(d.date, "UTC")}
                  {d.lines.length ? ` · ${amount(d.totals.total, d.currency)}` : ""}
                </span>
              </span>
              <span class={stateClass(d, false)}>{d.acceptable && !d.acceptance ? (d.type === "contract" ? "Pendiente de firma" : "Pendiente de aceptar") : d.statusLabel}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Party({ label, p }: { label: string; p?: PortalDocument["issuer"] }) {
  if (!p) return null;
  return (
    <div class="party">
      <p class="label">{label}</p>
      <p>
        <strong>{p.name}</strong>
      </p>
      {p.tradeName && <p>{p.tradeName}</p>}
      {p.taxId && <p>NIF: {p.taxId}</p>}
      {p.address && <p>{p.address}</p>}
      {[p.email, p.phone].filter(Boolean).length > 0 && <p>{[p.email, p.phone].filter(Boolean).join(" · ")}</p>}
    </div>
  );
}

const ERRORS: Record<string, string> = {
  nombre: "Escribe tu nombre completo.",
  casilla: "Marca la casilla para confirmar que lo aceptas.",
};

export function DocumentPage({
  snap,
  doc,
  token,
  acceptance,
  error,
}: {
  snap: PortalSnapshot;
  doc: PortalDocument;
  token: string;
  acceptance?: { name: string; at: string };
  error?: string;
}) {
  const tz = snap.timeZone;
  const cur = doc.currency;
  const t = doc.totals;
  const isInvoice = doc.type === "invoice";
  const verb = doc.type === "contract" ? "firmado" : "aceptado";
  return (
    <Layout title={doc.title} brand={snap.brand.name}>
      <Header snap={snap} token={token} back={`/p/${token}`} backLabel="Volver" />
      <main>
        {acceptance && (
          <p class="callout ok" role="status">
            {doc.type === "contract" ? "Contrato firmado" : "Propuesta aceptada"} por <strong>{acceptance.name}</strong> el{" "}
            {new Intl.DateTimeFormat("es", { dateStyle: "long", timeStyle: "short", timeZone: tz }).format(new Date(acceptance.at))}. ¡Gracias!
          </p>
        )}
        <article class="card paper">
          <header class="paper-head">
            <div>
              <p class="label">{doc.typeLabel}</p>
              <h1>{doc.title}</h1>
            </div>
            <dl class="meta">
              {doc.number && (
                <>
                  <dt>{isInvoice ? "Número" : "Referencia"}</dt>
                  <dd>{doc.number}</dd>
                </>
              )}
              <dt>{isInvoice ? "Fecha de expedición" : "Fecha"}</dt>
              <dd>{day(doc.date, "UTC")}</dd>
              {doc.dueDate && (
                <>
                  <dt>{isInvoice ? "Vencimiento" : doc.type === "proposal" ? "Válida hasta" : "Hasta"}</dt>
                  <dd>{day(doc.dueDate, "UTC")}</dd>
                </>
              )}
            </dl>
          </header>
          <div class="parties">
            <Party label={isInvoice ? "Emisor" : "De"} p={doc.issuer} />
            <Party label={isInvoice ? "Cliente" : "Para"} p={doc.customer} />
          </div>
          {doc.rectifies && (
            <p class="callout">
              Rectifica la factura <strong>{doc.rectifies.number}</strong> del {day(doc.rectifies.date, "UTC")}.
            </p>
          )}
          {doc.html && <div class="prose" dangerouslySetInnerHTML={{ __html: doc.html }} />}
          {doc.lines.length > 0 && (
            <div class="lines-wrap">
              <table class="lines">
                <thead>
                  <tr>
                    <th>Concepto</th>
                    <th class="num">Cant.</th>
                    <th class="num">Precio</th>
                    <th class="num">IVA</th>
                    <th class="num">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.lines.map((l) => (
                    <tr>
                      <td>{l.description}</td>
                      <td class="num">{l.quantity.toLocaleString("es")}</td>
                      <td class="num">{amount(l.unitPrice, cur)}</td>
                      <td class="num">{l.vat} %</td>
                      <td class="num">{amount(l.quantity * l.unitPrice, cur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <dl class="totals">
                <dt>Base imponible</dt>
                <dd>{amount(t.base, cur)}</dd>
                {t.vat.map((v) => (
                  <>
                    <dt>IVA {v.rate} %</dt>
                    <dd>{amount(v.amount, cur)}</dd>
                  </>
                ))}
                {t.irpf !== 0 && (
                  <>
                    <dt>Retención IRPF {doc.irpf} %</dt>
                    <dd>−{amount(t.irpf, cur)}</dd>
                  </>
                )}
                <dt class="grand">Total</dt>
                <dd class="grand">{amount(t.total, cur)}</dd>
              </dl>
            </div>
          )}
          {doc.notes && <p class="desc">{doc.notes}</p>}
          {isInvoice && (doc.footer || doc.qrSvg) && (
            <footer class="paper-foot">
              <div>
                {doc.footer?.iban && (
                  <p>
                    Forma de pago: transferencia a <strong>{doc.footer.iban}</strong>
                  </p>
                )}
                {doc.footer?.text && <p class="desc">{doc.footer.text}</p>}
              </div>
              {doc.qrSvg && (
                <div class="qr">
                  <span>QR tributario:</span>
                  <div class="qr-img" dangerouslySetInnerHTML={{ __html: doc.qrSvg }} />
                </div>
              )}
            </footer>
          )}
        </article>

        {doc.acceptable && !acceptance && (
          <section class="card" id="aceptar">
            <h2>{doc.acceptable.action}</h2>
            <p class="muted">
              Si estás de acuerdo, escribe tu nombre y confirma. Quedará registrado como {verb} electrónicamente con la fecha y hora.
            </p>
            {error && ERRORS[error] && (
              <p class="callout err" role="alert">
                {ERRORS[error]}
              </p>
            )}
            <form method="post" action={`/p/${token}/d/${doc.id}/accept`} class="accept">
              <label>
                <span>Nombre y apellidos</span>
                <input name="name" required minlength={3} maxlength={120} autocomplete="name" />
              </label>
              <label class="check">
                <input type="checkbox" name="agree" value="1" required />
                <span>
                  He leído {doc.type === "contract" ? "el contrato y lo firmo" : "la propuesta y la acepto"}
                  {doc.lines.length ? ` por ${amount(t.total, cur)}` : ""}.
                </span>
              </label>
              <button class="btn primary" type="submit">
                {doc.acceptable.action}
              </button>
            </form>
          </section>
        )}
        <p class="muted small center-text">Para guardarlo en PDF, usa Imprimir → Guardar como PDF en tu navegador.</p>
        <Contact snap={snap} />
      </main>
      <Footer snap={snap} token={token} />
    </Layout>
  );
}
