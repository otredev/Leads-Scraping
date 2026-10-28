"use client";

import { useMemo } from "react";
import { docTypeLabel, formatAmount, longDate, type DocumentSettings, type Party } from "@/core/documents";
import { renderMarkdown } from "@/lib/markdown";
import type { DocumentView } from "@/server/documents";

function PartyBlock({ label, party }: { label: string; party?: Party }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">{label}</p>
      {party?.name ? (
        <div className="text-[13px] leading-relaxed">
          <p className="font-semibold text-fg">{party.name}</p>
          {party.tradeName && <p>{party.tradeName}</p>}
          {party.taxId && <p>NIF: {party.taxId}</p>}
          {party.address && <p className="whitespace-pre-line">{party.address}</p>}
          {[party.email, party.phone].filter(Boolean).length > 0 && <p>{[party.email, party.phone].filter(Boolean).join(" · ")}</p>}
        </div>
      ) : (
        <p className="text-[13px] text-danger">Faltan datos</p>
      )}
    </div>
  );
}

/**
 * Documento tal como lo verá el cliente: es lo que se imprime o se guarda en PDF
 * (clase print-area: al imprimir se oculta el resto de la app).
 */
export function DocumentPaper({ doc, settings }: { doc: DocumentView; settings?: DocumentSettings }) {
  const html = useMemo(() => (doc.renderedBody.trim() ? renderMarkdown(doc.renderedBody) : ""), [doc.renderedBody]);
  const t = doc.totals;
  const isInvoice = doc.type === "invoice";
  const money = (n: number) => formatAmount(n, doc.currency);
  const label = isInvoice ? (doc.kind === "R4" ? "Factura rectificativa" : "Factura") : docTypeLabel(doc.type);

  return (
    <article className="print-area relative mx-auto w-full max-w-[820px] rounded-card border border-line bg-white px-6 py-8 text-[#1a1a1a] shadow-card sm:px-12 sm:py-12 print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
      {doc.status === "draft" && (
        <span className="absolute top-4 right-4 rounded-md border border-dashed border-[#bbb] px-2 py-0.5 text-[11px] font-semibold tracking-wide text-[#888] uppercase">
          Borrador
        </span>
      )}

      <header className="mb-8 flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="text-[11px] font-semibold tracking-wide text-[#777] uppercase">{label}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#111]">{doc.renderedTitle}</h1>
        </div>
        <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-[13px]">
          <dt className="text-[#777]">{isInvoice ? "Número" : "Referencia"}</dt>
          <dd className="text-right font-medium">{doc.number ?? (isInvoice ? "Al emitir" : "—")}</dd>
          <dt className="text-[#777]">{isInvoice ? "Fecha de expedición" : "Fecha"}</dt>
          <dd className="text-right">{longDate(doc.date)}</dd>
          {doc.dueDate && (
            <>
              <dt className="text-[#777]">{isInvoice ? "Vencimiento" : doc.type === "proposal" ? "Válida hasta" : "Hasta"}</dt>
              <dd className="text-right">{longDate(doc.dueDate)}</dd>
            </>
          )}
        </dl>
      </header>

      <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 print:grid-cols-2">
        <PartyBlock label={isInvoice ? "Emisor" : "De"} party={doc.issuer} />
        <PartyBlock label={isInvoice ? "Cliente" : "Para"} party={doc.customer} />
      </div>

      {doc.rectifies && (
        <p className="mb-6 rounded-lg bg-[#f4f4f4] px-3 py-2 text-[13px]">
          Rectifica la factura <strong>{doc.rectifies.number}</strong> del {longDate(doc.rectifies.date)}.
        </p>
      )}

      {html && <div className="doc-prose mb-8" dangerouslySetInnerHTML={{ __html: html }} />}

      {doc.lines.length > 0 && (
        <div className="mb-6 overflow-x-auto">
          <table className="w-full min-w-[480px] text-[13px] tabular-nums">
            <thead>
              <tr className="border-b-2 border-[#222] text-left text-[11px] tracking-wide text-[#555] uppercase">
                <th className="py-2 pr-3 font-semibold">Concepto</th>
                <th className="px-3 py-2 text-right font-semibold">Cant.</th>
                <th className="px-3 py-2 text-right font-semibold">Precio</th>
                <th className="px-3 py-2 text-right font-semibold">IVA</th>
                <th className="py-2 pl-3 text-right font-semibold">Importe</th>
              </tr>
            </thead>
            <tbody>
              {doc.lines.map((l, i) => (
                <tr key={i} className="border-b border-[#e5e5e5] align-top">
                  <td className="py-2 pr-3 whitespace-pre-line">{l.description}</td>
                  <td className="px-3 py-2 text-right">{l.quantity.toLocaleString("es")}</td>
                  <td className="px-3 py-2 text-right">{money(l.unitPrice)}</td>
                  <td className="px-3 py-2 text-right">{l.vat} %</td>
                  <td className="py-2 pl-3 text-right">{money(l.quantity * l.unitPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="mt-4 ml-auto grid w-full max-w-xs grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-[13px] tabular-nums">
            <dt className="text-[#555]">Base imponible</dt>
            <dd className="text-right">{money(t.base)}</dd>
            {t.vat.map((v) => (
              <div key={v.rate} className="contents">
                <dt className="text-[#555]">
                  IVA {v.rate} % {t.vat.length > 1 && <span className="text-[#999]">sobre {money(v.base)}</span>}
                </dt>
                <dd className="text-right">{money(v.amount)}</dd>
              </div>
            ))}
            {t.irpf !== 0 && (
              <>
                <dt className="text-[#555]">Retención IRPF {doc.irpf} %</dt>
                <dd className="text-right">−{money(t.irpf)}</dd>
              </>
            )}
            <dt className="mt-1 border-t-2 border-[#222] pt-2 font-semibold">Total</dt>
            <dd className="mt-1 border-t-2 border-[#222] pt-2 text-right text-base font-semibold">{money(t.total)}</dd>
          </dl>
        </div>
      )}

      {doc.notes && <p className="mb-6 text-[13px] whitespace-pre-line text-[#444]">{doc.notes}</p>}

      {isInvoice && (
        <footer className="mt-10 flex flex-wrap items-end justify-between gap-6 border-t border-[#e5e5e5] pt-5 text-[12px] text-[#555]">
          <div className="max-w-md space-y-1">
            {settings?.iban && doc.kind !== "R4" && (
              <p>
                Forma de pago: transferencia a <strong className="text-[#222]">{settings.iban}</strong>
              </p>
            )}
            {settings?.invoiceFooter && <p className="whitespace-pre-line">{settings.invoiceFooter}</p>}
          </div>
          {doc.qrSvg && (
            <div className="flex flex-col items-center gap-1 text-center">
              <span className="text-[10px] text-[#555]">QR tributario:</span>
              {/* 35 mm aprox. al imprimir (la AEAT pide entre 30 y 40 mm) */}
              <div className="size-[35mm] [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: doc.qrSvg }} />
            </div>
          )}
        </footer>
      )}

      {doc.acceptance && (
        <p className="mt-8 border-t border-[#e5e5e5] pt-4 text-[12px] text-[#555]">
          {doc.type === "contract" ? "Firmado" : "Aceptado"} electrónicamente por <strong className="text-[#222]">{doc.acceptance.name}</strong> el{" "}
          {new Date(doc.acceptance.at).toLocaleString("es", { dateStyle: "long", timeStyle: "short" })}
          {doc.acceptance.via === "portal" ? " desde el portal del cliente" : ""}.
        </p>
      )}
    </article>
  );
}
