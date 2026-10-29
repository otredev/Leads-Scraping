/**
 * Estilos del portal: los mismos colores, tipografía (Schibsted Grotesk), tarjetas,
 * botones y campos que la app (src/app/globals.css). Modo oscuro automático.
 */
const STYLES = `
@font-face {
  font-family: "Schibsted Grotesk";
  font-style: normal;
  font-weight: 400 900;
  font-display: swap;
  src: url(/font.woff2) format("woff2");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
:root {
  --bg: #f5f5f5; --surface: #ffffff; --surface-2: #f6f6f6; --line: #e7e7e7; --line-strong: #d6d6d6;
  --fg: #0a0a0a; --fg-2: #3d3d3d; --muted: #737373;
  --primary: #0a0a0a; --primary-hover: #2a2a2a; --primary-fg: #ffffff; --primary-soft: #efefef; --track: #e6e6e6;
  --success: #2f7a55; --success-soft: #edf5f0; --warning: #8a6a1f; --warning-soft: #f7f2e6; --danger: #b0413e; --danger-soft: #f8ecec;
  --card-shadow: 0 1px 2px rgb(0 0 0 / 0.04), 0 2px 6px rgb(0 0 0 / 0.03);
  --radius: 14px;
  --font: "Schibsted Grotesk", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0a0a0a; --surface: #141414; --surface-2: #1b1b1b; --line: #262626; --line-strong: #333333;
    --fg: #f5f5f5; --fg-2: #cfcfcf; --muted: #8c8c8c;
    --primary: #f5f5f5; --primary-hover: #dcdcdc; --primary-fg: #0a0a0a; --primary-soft: #232323; --track: #2b2b2b;
    --success: #6fbf94; --success-soft: #16231c; --warning: #d2b066; --warning-soft: #26210f; --danger: #e08482; --danger-soft: #2a1717;
    --card-shadow: 0 1px 2px rgb(0 0 0 / 0.5);
  }
}

/* ── Base ── */
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; background: var(--bg); }
body { margin: 0; background: var(--bg); color: var(--fg); font-family: var(--font); font-size: 14.5px; line-height: 1.5; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
a { color: inherit; }
h1, h2, h3 { margin: 0; color: var(--fg); }
h1 { font-size: 28px; font-weight: 600; letter-spacing: -0.02em; line-height: 1.2; }
h2 { font-size: 15px; font-weight: 600; line-height: 1.35; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
p { margin: 0; }
ul, ol { margin: 0; }
button, input, select, textarea { font: inherit; color: inherit; }
::selection { background: var(--track); }
:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; border-radius: 6px; }
.muted { color: var(--muted); }
.small { font-size: 13px; }
.title { font-weight: 500; color: var(--fg); }
.center-text { text-align: center; }

/* ── Estructura ── */
.wrap { max-width: 800px; margin: 0 auto; padding: 0 16px 48px; }
.top { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 18px 0; margin-bottom: 24px; border-bottom: 1px solid var(--line); }
.brand { display: inline-flex; align-items: center; gap: 10px; font-size: 15px; font-weight: 600; letter-spacing: -0.01em; color: var(--fg); }
a.brand { text-decoration: none; border-radius: 10px; }
a.brand:hover .logo { background: var(--primary-hover); }
.logo { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 9px; background: var(--primary); color: var(--primary-fg); font-size: 14px; font-weight: 700; transition: background .15s; }
.back { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 8px; font-size: 13.5px; font-weight: 500; color: var(--fg-2); text-decoration: none; transition: background .15s, color .15s; }
.back:hover { background: var(--surface-2); color: var(--fg); }
main { display: flex; flex-direction: column; gap: 16px; }
.center { min-height: 70vh; justify-content: center; text-align: center; align-items: center; gap: 8px; }
.hero { display: flex; flex-direction: column; gap: 6px; padding: 0 2px 8px; }
.hero > p { max-width: 640px; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.row h1, .row h2 { min-width: 0; }

/* ── Tarjetas ── */
.card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--card-shadow); padding: 20px; display: flex; flex-direction: column; gap: 14px; }
.card > h2 + .muted, .card > .row + .muted { margin-top: -8px; font-size: 13.5px; }
.callout { background: var(--surface-2); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; font-size: 13.5px; color: var(--fg-2); }
.callout.ok { background: var(--success-soft); border-color: transparent; color: var(--success); }
.callout.err { background: var(--danger-soft); border-color: transparent; color: var(--danger); }
.desc { white-space: pre-wrap; color: var(--fg-2); }
details { border-top: 1px solid var(--line); padding-top: 12px; }
summary { cursor: pointer; font-size: 13.5px; font-weight: 500; color: var(--fg-2); }
summary:hover { color: var(--fg); }

/* ── Insignias ── */
.pill, .count { display: inline-flex; align-items: center; flex-shrink: 0; gap: 6px; border-radius: 999px; font-size: 12px; font-weight: 500; white-space: nowrap; }
.pill { padding: 2px 9px; background: var(--surface-2); border: 1px solid var(--line); color: var(--fg-2); }
.pill.s-delivered { background: var(--success-soft); color: var(--success); border-color: transparent; }
.pill.s-active, .pill.s-review { background: var(--primary); color: var(--primary-fg); border-color: var(--primary); }
.pill.s-paused { background: var(--warning-soft); color: var(--warning); border-color: transparent; }
.count { padding: 1px 8px; background: var(--primary); color: var(--primary-fg); }

/* ── Proyectos ── */
.projects { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.project { text-decoration: none; transition: border-color .15s, box-shadow .15s; }
.project:hover { border-color: var(--line-strong); }
.project:hover h2 { text-decoration: underline; text-underline-offset: 3px; }
.progress { flex: 1; min-width: 0; height: 6px; border: 0; border-radius: 999px; background: var(--track); overflow: hidden; -webkit-appearance: none; appearance: none; color: var(--primary); }
.progress.big { height: 10px; }
.progress::-webkit-progress-bar { background: var(--track); border-radius: 999px; }
.progress::-webkit-progress-value { background: var(--primary); border-radius: 999px; }
.progress::-moz-progress-bar { background: var(--primary); border-radius: 999px; }
.pct { font-variant-numeric: tabular-nums; min-width: 42px; text-align: right; font-size: 13.5px; font-weight: 500; }
.big-progress { margin-top: 4px; }
.big-progress .pct { font-size: 22px; font-weight: 600; letter-spacing: -0.02em; }

/* ── Hitos y tareas ── */
.timeline { list-style: none; margin: 0; padding: 0 0 0 32px; position: relative; display: flex; flex-direction: column; gap: 16px; }
.timeline::before { content: ""; position: absolute; left: 10px; top: 8px; bottom: 8px; width: 2px; background: var(--line); }
.timeline li { position: relative; display: flex; flex-direction: column; gap: 1px; }
.timeline .dot { position: absolute; left: -32px; top: 0; width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--line-strong); background: var(--surface); display: grid; place-items: center; font-size: 11px; font-weight: 700; }
.timeline .done .dot { background: var(--primary); border-color: var(--primary); color: var(--primary-fg); }
.timeline .late .dot { border-color: var(--danger); }
.timeline .done .title { color: var(--muted); text-decoration: line-through; }
.late .small { color: var(--danger); font-weight: 500; }
.items { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.item { display: flex; gap: 10px; padding: 10px 0; border-top: 1px solid var(--line); }
.item:first-child { border-top: 0; padding-top: 0; }
.item > span:last-child { display: flex; flex-direction: column; }
.item .check { flex-shrink: 0; width: 18px; height: 18px; margin-top: 2px; border: 1.5px solid var(--line-strong); border-radius: 5px; display: grid; place-items: center; font-size: 11px; font-weight: 700; }
.item.done .check { background: var(--primary); border-color: var(--primary); color: var(--primary-fg); }
.item.done .title { color: var(--muted); text-decoration: line-through; }

/* ── Pagos ── */
.money { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 0; }
.money div { background: var(--surface-2); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; }
.money dt { font-size: 12px; font-weight: 500; color: var(--muted); }
.money dd { margin: 2px 0 0; font-size: 17px; font-weight: 600; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; }
.payments { list-style: none; margin: 0; padding: 0; }
.payments li { display: grid; grid-template-columns: 110px 1fr auto; gap: 12px; padding: 9px 0; border-top: 1px solid var(--line); font-size: 13.5px; align-items: center; }

/* ── Botones ── */
.actions { display: flex; flex-wrap: wrap; gap: 8px; }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 38px; padding: 8px 14px; border-radius: 8px; border: 1px solid var(--line); background: var(--surface); color: var(--fg); font-size: 14px; font-weight: 500; line-height: 1.2; text-decoration: none; cursor: pointer; overflow-wrap: anywhere; transition: background .15s, border-color .15s; }
.btn:hover { background: var(--surface-2); }
.btn.primary { background: var(--primary); border-color: var(--primary); color: var(--primary-fg); }
.btn.primary:hover { background: var(--primary-hover); border-color: var(--primary-hover); }

/* ── Formularios (como los campos de la app) ── */
.accept { display: flex; flex-direction: column; gap: 14px; }
.accept label { display: flex; flex-direction: column; gap: 6px; }
.accept label > span:first-child { font-size: 13px; font-weight: 500; color: var(--fg-2); }
.accept input[type="text"], .accept input[name="name"], .accept textarea, .accept select {
  width: 100%; padding: 8px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--surface); color: var(--fg); font-size: 14px;
  transition: border-color .15s, box-shadow .15s;
}
.accept input:focus, .accept textarea:focus, .accept select:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-soft); }
.accept input[name="name"], .accept select { min-height: 40px; }
.accept select { appearance: none; -webkit-appearance: none; padding-right: 36px; cursor: pointer;
  background-image: linear-gradient(45deg, transparent 50%, var(--muted) 50%), linear-gradient(135deg, var(--muted) 50%, transparent 50%);
  background-position: calc(100% - 17px) 50%, calc(100% - 12px) 50%; background-size: 5px 5px; background-repeat: no-repeat; }
.accept textarea { resize: vertical; min-height: 120px; line-height: 1.5; }
.accept .check { flex-direction: row; align-items: flex-start; gap: 10px; padding: 12px 14px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-2); cursor: pointer; font-size: 14px; color: var(--fg); }
.accept .check:hover { border-color: var(--line-strong); }
.accept .check > span:first-child, .accept .check span { font-size: 14px; font-weight: 400; color: var(--fg); }
.accept .check input { flex-shrink: 0; width: 18px; height: 18px; margin: 1px 0 0; accent-color: var(--primary); cursor: pointer; }
.accept .btn { align-self: flex-start; font-weight: 600; }

/* ── Aceptación de las condiciones ── */
.consent { max-width: 560px; width: 100%; margin: 4vh auto 0; padding: 28px; gap: 16px; }
.consent h1 { font-size: 24px; }
.consent-links { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
.consent-links li { padding: 10px 14px; border-top: 1px solid var(--line); font-size: 13.5px; color: var(--muted); }
.consent-links li:first-child { border-top: 0; }
.consent-links a { color: var(--fg); font-weight: 500; text-decoration: underline; text-decoration-color: var(--line-strong); text-underline-offset: 3px; }
.consent-links a:hover { text-decoration-color: var(--fg); }
.consent .accept .btn { align-self: stretch; min-height: 42px; }

/* ── Mensajes ── */
.thread { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.msg { max-width: 80%; display: flex; flex-direction: column; gap: 3px; }
.msg.mine { align-self: flex-end; align-items: flex-end; }
.msg.theirs { align-self: flex-start; align-items: flex-start; }
.msg-meta { font-size: 11.5px; color: var(--muted); padding: 0 4px; }
.msg-body { white-space: pre-wrap; overflow-wrap: anywhere; padding: 9px 13px; border-radius: 14px; font-size: 14.5px; line-height: 1.5; }
.msg.mine .msg-body { background: var(--primary); color: var(--primary-fg); border-bottom-right-radius: 4px; }
.msg.theirs .msg-body { background: var(--surface-2); border: 1px solid var(--line); color: var(--fg); border-bottom-left-radius: 4px; }
.thread.compact { gap: 8px; }
.thread.compact .msg-body { font-size: 13.5px; padding: 7px 11px; }

/* ── Documentos ── */
.doc-item { padding: 0; }
.doc-link { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; padding: 10px 0; text-decoration: none; }
.doc-link > span:first-child { display: flex; flex-direction: column; min-width: 0; }
.doc-link:hover .title { text-decoration: underline; text-underline-offset: 3px; }
.paper { gap: 18px; }
.paper .label, .party .label { font-size: 11px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; color: var(--muted); margin-bottom: 4px; }
.paper-head { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 16px; }
.meta { display: grid; grid-template-columns: auto auto; gap: 2px 14px; margin: 0; font-size: 13px; }
.meta dt { color: var(--muted); }
.meta dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; }
.parties { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; font-size: 13px; line-height: 1.5; }
.prose { color: var(--fg-2); font-size: 14.5px; line-height: 1.65; }
.prose h1, .prose h2, .prose h3 { color: var(--fg); margin: 1.3em 0 .4em; font-size: 16px; font-weight: 600; display: block; letter-spacing: -0.01em; }
.prose p { margin: .6em 0; }
.prose ul, .prose ol { padding-left: 1.3em; }
.prose strong { color: var(--fg); font-weight: 600; }
.prose a { text-decoration: underline; }
.lines-wrap { overflow-x: auto; }
.lines { width: 100%; border-collapse: collapse; font-size: 13px; font-variant-numeric: tabular-nums; min-width: 460px; }
.lines th { text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); border-bottom: 1px solid var(--line-strong); padding: 6px 8px 8px 0; }
.lines td { border-bottom: 1px solid var(--line); padding: 9px 8px 9px 0; vertical-align: top; }
.lines .num { text-align: right; }
.totals { display: grid; grid-template-columns: 1fr auto; gap: 4px 20px; max-width: 300px; margin: 12px 0 0 auto; font-size: 13px; font-variant-numeric: tabular-nums; }
.totals dt { color: var(--muted); }
.totals dd { margin: 0; text-align: right; }
.totals .grand { border-top: 1px solid var(--line-strong); padding-top: 8px; margin-top: 4px; font-weight: 700; color: var(--fg); font-size: 15px; }
.paper-foot { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 16px; border-top: 1px solid var(--line); padding-top: 14px; font-size: 12.5px; color: var(--fg-2); }
.qr { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 10px; color: var(--muted); }
.qr-img { width: 35mm; height: 35mm; background: #fff; padding: 4px; border-radius: 4px; }
.qr-img svg { width: 100%; height: 100%; display: block; }

/* ── Páginas legales ── */
.legal { gap: 0; padding: 28px; }
.legal h1 { margin-bottom: 4px; font-size: 26px; }
.legal h2 { font-size: 17px; margin: 24px 0 8px; }
.legal p, .legal li { color: var(--fg-2); line-height: 1.65; }
.legal p + p { margin-top: 8px; }
.legal ul + p { margin-top: 10px; }
.legal ul { margin: 6px 0 0; padding-left: 20px; display: flex; flex-direction: column; gap: 4px; }
.legal li::marker { color: var(--muted); }
.legal dl { margin: 4px 0 0; display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; }
.legal dt { color: var(--muted); }
.legal dd { margin: 0; color: var(--fg); overflow-wrap: anywhere; }
.legal .callout { margin-top: 12px; }
.legal .pending { color: var(--muted); font-style: italic; }

/* ── Pie ── */
.foot { margin-top: 32px; padding-top: 20px; border-top: 1px solid var(--line); text-align: center; font-size: 12.5px; color: var(--muted); display: flex; flex-direction: column; gap: 8px; }
.foot a { color: var(--muted); }
.legal-links { display: flex; justify-content: center; flex-wrap: wrap; gap: 4px 18px; }
.legal-links a { text-decoration: none; }
.legal-links a:hover, .legal-links a[aria-current] { color: var(--fg); text-decoration: underline; text-underline-offset: 3px; }

@media (max-width: 520px) {
  h1 { font-size: 24px; }
  .top { padding: 14px 0; margin-bottom: 18px; }
  .card { padding: 16px; }
  .consent, .legal { padding: 20px; margin-top: 0; }
  .msg { max-width: 90%; }
  .payments li { grid-template-columns: 1fr auto; }
  .payments li span:first-child { grid-column: 1 / -1; }
  .money dd { font-size: 15px; }
  .parties { grid-template-columns: 1fr; }
  .legal dl { grid-template-columns: 1fr; gap: 0; }
  .legal dd { margin-bottom: 8px; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition: none !important; }
}
@media print {
  .top, .foot, #aceptar, .center-text, .card:not(.paper), .callout.ok { display: none !important; }
  body { background: #fff; }
  .paper { border: 0; box-shadow: none; padding: 0; }
}
`;

export const CSS = STYLES;

/** Huella corta de la hoja (FNV-1a): va en la URL para que cada cambio se descargue de nuevo. */
export const CSS_VERSION = (() => {
  let h = 0x811c9dc5;
  for (let i = 0; i < STYLES.length; i++) {
    h ^= STYLES.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
})();
