import { formatMoney } from "@/core/clients";
import type { FinanceReport } from "@/core/finance";

export interface Insight {
  tone: "good" | "warn" | "info";
  text: string;
}

/** Recomendaciones automáticas a partir del informe (qué funciona y qué revisar). */
export function insights(r: FinanceReport): Insight[] {
  const out: Insight[] = [];
  const m = (n: number) => formatMoney(Math.round(n), r.currency);

  if (!r.hourlyCost) out.push({ tone: "info", text: "Indica el coste de tu hora (botón Ajustes) para ver el beneficio real descontando tu tiempo." });

  // Canales de captación
  const invested = r.channels.filter((c) => c.spend > 0 && c.roi !== undefined);
  const best = [...invested].sort((a, b) => b.roi! - a.roi!)[0];
  if (best && best.roi! > 0)
    out.push({ tone: "good", text: `${best.channel} es tu mejor inversión: cada euro invertido te deja ${(best.roi! / 100).toFixed(1).replace(".", ",")} € de beneficio.` });
  for (const c of invested.filter((c) => c.roi! < 0))
    out.push({
      tone: "warn",
      text: `${c.channel}: has invertido ${m(c.spend)} y ${c.revenue ? `solo ha dejado ${m(c.profitBeforeAcquisition)} de beneficio` : "aún no ha traído clientes que paguen"}. Revisa si compensa.`,
    });

  // Clientes que hacen perder dinero (solo los que ya han pagado algo: los recién empezados aún no cuentan)
  const losing = r.clients.filter((c) => c.net < 0 && c.revenue > 0);
  const starting = r.clients.filter((c) => c.revenue === 0 && (c.direct || c.timeCost));
  if (losing.length)
    out.push({
      tone: "warn",
      text: `${losing.length === 1 ? "Un cliente te hace" : `${losing.length} clientes te hacen`} perder dinero en este periodo: ${losing
        .slice(0, 3)
        .map((c) => `${c.name} (${m(c.net)})`)
        .join(", ")}${losing.length > 3 ? "…" : ""}.`,
    });
  if (starting.length)
    out.push({
      tone: "info",
      text: `${starting.map((c) => c.name).slice(0, 3).join(", ")}${starting.length > 3 ? "…" : ""}: ${starting.length === 1 ? "tiene" : "tienen"} horas o gastos pero aún ningún cobro en este periodo.`,
    });

  // Clientes que pagan menos que tu hora
  if (r.hourlyCost) {
    const cheap = r.clients.filter((c) => c.perHour !== undefined && c.minutes >= 120 && c.perHour < r.hourlyCost!).sort((a, b) => a.perHour! - b.perHour!);
    if (cheap[0])
      out.push({
        tone: "warn",
        text: `Con ${cheap[0].name} ganas ${m(cheap[0].perHour!)}/h, menos que el coste de tu hora (${m(r.hourlyCost)}). Sube el precio o reduce horas.`,
      });
  }

  // Segmento más rentable
  const seg = r.segments.category.filter((s) => s.key !== "Sin datos" && s.revenue > 0);
  if (seg.length >= 2) {
    const top = [...seg].sort((a, b) => b.netPerClient - a.netPerClient)[0];
    out.push({ tone: "good", text: `Los clientes de "${top.key}" son los más rentables: ${m(top.netPerClient)} de beneficio medio cada uno. Prioriza ese sector al buscar leads.` });
  }

  // Peso de los gastos fijos
  const monthlyFixed = r.recurring.filter((x) => x.active).reduce((s, x) => s + x.monthly, 0);
  const avgRevenue = r.totals.revenue / Math.max(1, r.months.length);
  if (monthlyFixed > 0 && avgRevenue > 0 && monthlyFixed / avgRevenue > 0.2)
    out.push({
      tone: "warn",
      text: `Tus gastos recurrentes (${m(monthlyFixed)}/mes) son el ${Math.round((monthlyFixed / avgRevenue) * 100)} % de lo que ingresas al mes. Revisa las suscripciones en Inversión.`,
    });

  if (r.unallocated.acquisition > 0)
    out.push({ tone: "info", text: `${m(r.unallocated.acquisition)} de captación no se han podido repartir: ningún cliente de esos canales ha pagado en el periodo.` });

  if (!out.length && r.totals.revenue > 0) out.push({ tone: "good", text: `Margen del ${r.totals.margin} %. Todo en orden en este periodo.` });
  return out;
}
