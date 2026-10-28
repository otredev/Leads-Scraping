import { Marked } from "marked";

/**
 * Markdown de los documentos (propuestas, contratos) a HTML.
 * El HTML escrito a mano se muestra como texto: así un documento no puede
 * meter scripts ni estilos en la app ni en el portal del cliente.
 */
const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const marked = new Marked({ gfm: true, breaks: true });
marked.use({
  renderer: {
    html: ({ text }) => escape(text),
    link: ({ href, text }) => {
      const safe = /^(https?:|mailto:|tel:)/i.test(href) ? href : "#";
      return `<a href="${escape(safe)}" rel="noopener noreferrer">${escape(text)}</a>`;
    },
    image: ({ text }) => escape(text),
  },
});

export function renderMarkdown(md: string): string {
  return marked.parse(md, { async: false }) as string;
}
