/** Estilos del portal: mismo lenguaje visual que la app (blanco, grises y negro; modo oscuro automático). */
export const CSS = `
:root {
  --bg: #f5f5f5; --surface: #ffffff; --surface-2: #f0f0f0; --fg: #111111; --fg-2: #3d3d3d; --muted: #6b6b6b;
  --line: #e5e5e5; --line-strong: #d0d0d0; --primary: #111111; --primary-fg: #ffffff; --track: #e8e8e8;
  --danger: #c62828; --danger-soft: #fdecec; --success: #1b7f3b; --success-soft: #e8f5ec;
  --radius: 16px;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0a0a0a; --surface: #141414; --surface-2: #1d1d1d; --fg: #f2f2f2; --fg-2: #cfcfcf; --muted: #9a9a9a;
    --line: #262626; --line-strong: #383838; --primary: #f2f2f2; --primary-fg: #0a0a0a; --track: #2a2a2a;
    --danger: #f08080; --danger-soft: #2a1414; --success: #6fcf8f; --success-soft: #132a1b;
  }
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 15px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
a { color: inherit; }
h1, h2 { margin: 0; letter-spacing: -0.01em; line-height: 1.25; }
h1 { font-size: 26px; }
h2 { font-size: 16px; display: flex; align-items: center; gap: 8px; }
p { margin: 0; }
.wrap { max-width: 760px; margin: 0 auto; padding: 16px 16px 40px; }
.top { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0 20px; flex-wrap: wrap; }
.brand { display: inline-flex; align-items: center; gap: 10px; font-weight: 600; }
.logo { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 9px; background: var(--primary); color: var(--primary-fg); font-size: 15px; }
.back { font-size: 14px; color: var(--fg-2); text-decoration: none; }
.back:hover { color: var(--fg); text-decoration: underline; }
main { display: flex; flex-direction: column; gap: 16px; }
.center { min-height: 70vh; justify-content: center; text-align: center; align-items: center; }
.hero { padding: 4px 2px 8px; display: flex; flex-direction: column; gap: 6px; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 20px; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 1px 2px rgb(0 0 0 / 0.04); }
.muted { color: var(--muted); }
.small { font-size: 13px; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.row h1, .row h2 { min-width: 0; }
.projects { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.project { text-decoration: none; transition: border-color .15s; }
.project:hover { border-color: var(--line-strong); }
.pill { flex-shrink: 0; font-size: 12px; font-weight: 500; padding: 3px 10px; border-radius: 999px; border: 1px solid var(--line); color: var(--fg-2); white-space: nowrap; }
.pill.s-delivered { background: var(--success-soft); color: var(--success); border-color: transparent; }
.pill.s-active, .pill.s-review { background: var(--surface-2); color: var(--fg); }
.progress { flex: 1; min-width: 0; height: 8px; border: 0; border-radius: 999px; background: var(--track); overflow: hidden; -webkit-appearance: none; appearance: none; color: var(--primary); }
.progress.big { height: 12px; }
.progress::-webkit-progress-bar { background: var(--track); border-radius: 999px; }
.progress::-webkit-progress-value { background: var(--primary); border-radius: 999px; }
.progress::-moz-progress-bar { background: var(--primary); border-radius: 999px; }
.pct { font-variant-numeric: tabular-nums; min-width: 42px; text-align: right; font-size: 14px; }
.big-progress { margin-top: 4px; }
.big-progress .pct { font-size: 20px; }
.callout { background: var(--surface-2); border-radius: 10px; padding: 10px 12px; font-size: 14px; }
.desc { white-space: pre-wrap; color: var(--fg-2); }
.timeline { list-style: none; margin: 0; padding: 0 0 0 30px; position: relative; display: flex; flex-direction: column; gap: 16px; }
.timeline::before { content: ""; position: absolute; left: 10px; top: 6px; bottom: 6px; width: 2px; background: var(--line); }
.timeline li { position: relative; display: flex; flex-direction: column; }
.timeline .dot { position: absolute; left: -30px; top: 1px; width: 22px; height: 22px; border-radius: 50%; border: 2px solid var(--line-strong); background: var(--surface); display: grid; place-items: center; font-size: 12px; font-weight: 700; }
.timeline .done .dot { background: var(--primary); border-color: var(--primary); color: var(--primary-fg); }
.timeline .late .dot { border-color: var(--danger); }
.timeline .done .title { color: var(--muted); text-decoration: line-through; }
.late .small { color: var(--danger); font-weight: 500; }
.title { font-weight: 500; }
.count { font-size: 12px; font-weight: 500; color: var(--muted); border: 1px solid var(--line); border-radius: 999px; padding: 0 8px; }
.items { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.item { display: flex; gap: 10px; padding: 9px 0; border-top: 1px solid var(--line); }
.item:first-child { border-top: 0; }
.item > span:last-child { display: flex; flex-direction: column; }
.item .check { flex-shrink: 0; width: 18px; height: 18px; margin-top: 2px; border: 1.5px solid var(--line-strong); border-radius: 5px; display: grid; place-items: center; font-size: 11px; font-weight: 700; }
.item.done .check { background: var(--primary); border-color: var(--primary); color: var(--primary-fg); }
.item.done .title { color: var(--muted); text-decoration: line-through; }
details { border-top: 1px solid var(--line); padding-top: 10px; }
summary { cursor: pointer; font-size: 14px; color: var(--fg-2); }
.money { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 0; }
.money div { background: var(--surface-2); border-radius: 10px; padding: 10px; text-align: center; }
.money dt { font-size: 12px; color: var(--muted); }
.money dd { margin: 2px 0 0; font-weight: 600; font-variant-numeric: tabular-nums; }
.payments { list-style: none; margin: 0; padding: 0; }
.payments li { display: grid; grid-template-columns: 110px 1fr auto; gap: 12px; padding: 8px 0; border-top: 1px solid var(--line); font-size: 14px; align-items: center; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; }
.btn { display: inline-flex; align-items: center; justify-content: center; min-height: 40px; padding: 8px 14px; border-radius: 10px; border: 1px solid var(--line); background: var(--surface); font-size: 14px; font-weight: 500; text-decoration: none; word-break: break-all; }
.btn:hover { border-color: var(--line-strong); }
.btn.primary { background: var(--primary); color: var(--primary-fg); border-color: var(--primary); }
.foot { margin-top: 28px; text-align: center; font-size: 12px; color: var(--muted); display: flex; flex-direction: column; gap: 6px; }
.legal-links { display: flex; justify-content: center; flex-wrap: wrap; gap: 4px 16px; }
.legal-links a { color: var(--muted); text-decoration: none; }
.legal-links a:hover, .legal-links a[aria-current] { color: var(--fg); text-decoration: underline; }
.legal { gap: 0; }
.legal h1 { margin-bottom: 4px; }
.legal h2 { font-size: 17px; margin: 22px 0 8px; }
.legal p, .legal li { color: var(--fg-2); }
.legal p + p { margin-top: 8px; }
.legal ul + p { margin-top: 10px; }
.legal ul { margin: 6px 0 0; padding-left: 20px; display: flex; flex-direction: column; gap: 4px; }
.legal dl { margin: 4px 0 0; display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; }
.legal dt { color: var(--muted); }
.legal dd { margin: 0; color: var(--fg); overflow-wrap: anywhere; }
.legal .callout { margin-top: 12px; }
.legal .pending { color: var(--muted); font-style: italic; }
:focus-visible { outline: 2px solid var(--fg); outline-offset: 2px; border-radius: 6px; }
@media (max-width: 480px) {
  h1 { font-size: 22px; }
  .card { padding: 16px; }
  .payments li { grid-template-columns: 1fr auto; }
  .payments li span:first-child { grid-column: 1 / -1; }
  .legal dl { grid-template-columns: 1fr; gap: 0; }
  .legal dd { margin-bottom: 8px; }
}
`;
