import "server-only";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Marked, type Tokens } from "marked";

/**
 * Documentación de la app (página Ayuda).
 *
 * Cada guía es un fichero Markdown en src/content/docs/ con una cabecera:
 *   ---
 *   title: Primeros pasos
 *   description: Instala y arranca la app
 *   order: 1
 *   ---
 * El nombre del fichero (sin .md) es la dirección: /ayuda/<nombre>.
 * Se leen al compilar, así que la ayuda funciona sin conexión.
 */

export interface DocHeading {
  id: string;
  text: string;
  depth: 2 | 3;
}

export interface Doc {
  slug: string;
  title: string;
  description: string;
  order: number;
  html: string;
  headings: DocHeading[];
  /** Texto plano para el buscador. */
  text: string;
}

const DIR = path.join(/*turbopackIgnore: true*/ process.cwd(), "src", "content", "docs");

export function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseFrontmatter(raw: string) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  const meta: Record<string, string> = {};
  if (m) for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: m ? raw.slice(m[0].length) : raw };
}

function render(body: string) {
  const headings: DocHeading[] = [];
  const used = new Set<string>();
  const marked = new Marked({ gfm: true });
  marked.use({
    renderer: {
      heading(this: { parser: { parseInline(t: Tokens.Heading["tokens"]): string } }, { tokens, depth, text }: Tokens.Heading) {
        const inner = this.parser.parseInline(tokens);
        let id = slugify(text) || "seccion";
        while (used.has(id)) id += "-";
        used.add(id);
        if (depth === 2 || depth === 3) headings.push({ id, text: text.replace(/[*_`]/g, ""), depth });
        return `<h${depth} id="${id}"><a href="#${id}" class="anchor" aria-hidden="true">#</a>${inner}</h${depth}>\n`;
      },
      link({ href, title, tokens }: Tokens.Link) {
        // Enlaces externos en pestaña nueva; los internos (/ayuda/…, /leads…) en la misma.
        const inner = this.parser.parseInline(tokens);
        const external = /^https?:\/\//.test(href);
        return `<a href="${href}"${title ? ` title="${title}"` : ""}${external ? ' target="_blank" rel="noreferrer"' : ""}>${inner}</a>`;
      },
    },
  });
  const html = marked.parse(body, { async: false }) as string;
  const text = body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`|[\]()-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { html, headings, text };
}

let cache: Doc[] | undefined;

export function listDocs(): Doc[] {
  if (cache && process.env.NODE_ENV === "production") return cache;
  const docs = readdirSync(DIR)
    .filter((f) => f.endsWith(".md"))
    .map((file) => {
      const parsed = parseFrontmatter(readFileSync(path.join(DIR, file), "utf8"));
      const { meta } = parsed;
      // El título ya sale en la cabecera de la página: se quita el "# Título" inicial.
      const body = parsed.body.replace(/^\s*#\s+[^\n]*\n/, "");
      const slug = file.replace(/\.md$/, "");
      return { slug, title: meta.title ?? slug, description: meta.description ?? "", order: Number(meta.order ?? 99), ...render(body) };
    })
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, "es"));
  cache = docs;
  return docs;
}

export function getDoc(slug: string) {
  return listDocs().find((d) => d.slug === slug);
}
