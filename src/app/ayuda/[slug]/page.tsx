import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { getDoc, listDocs } from "@/server/docs";
import { HelpLayout } from "@/components/help/HelpLayout";

export function generateStaticParams() {
  return listDocs().map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: PageProps<"/ayuda/[slug]">) {
  const doc = getDoc((await params).slug);
  return { title: doc ? `${doc.title} · Ayuda` : "Ayuda", description: doc?.description };
}

export default async function Page({ params }: PageProps<"/ayuda/[slug]">) {
  const { slug } = await params;
  const docs = listDocs();
  const i = docs.findIndex((d) => d.slug === slug);
  const doc = docs[i];
  if (!doc) notFound();
  const prev = docs[i - 1];
  const next = docs[i + 1];

  const toc = doc.headings.length > 1 && (
    <div className="text-sm">
      <p className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">En esta página</p>
      <ul className="flex flex-col gap-1.5">
        {doc.headings.map((h) => (
          <li key={h.id} className={h.depth === 3 ? "pl-3" : ""}>
            <a href={`#${h.id}`} className="text-fg-2 hover:text-fg">
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <>
      <Link href="/ayuda" className="mb-3 inline-flex items-center gap-1.5 text-sm text-fg-2 hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden /> Ayuda
      </Link>
      <header className="mb-6 lg:mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-[28px]">{doc.title}</h1>
        <p className="mt-1 max-w-2xl text-muted">{doc.description}</p>
      </header>
      <HelpLayout docs={docs} current={doc.slug} aside={toc}>
        <article className="card px-5 py-6 sm:px-8">
          <div className="docs-prose" dangerouslySetInnerHTML={{ __html: doc.html }} />
        </article>
        <nav className="mt-6 grid grid-cols-2 gap-4" aria-label="Guía anterior y siguiente">
          {prev ? (
            <Link href={`/ayuda/${prev.slug}`} className="card flex flex-col gap-0.5 p-4 hover:border-line-strong">
              <span className="flex items-center gap-1 text-xs text-muted">
                <ArrowLeft className="size-3.5" aria-hidden /> Anterior
              </span>
              <span className="text-sm font-medium">{prev.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link href={`/ayuda/${next.slug}`} className="card flex flex-col items-end gap-0.5 p-4 text-right hover:border-line-strong">
              <span className="flex items-center gap-1 text-xs text-muted">
                Siguiente <ArrowRight className="size-3.5" aria-hidden />
              </span>
              <span className="text-sm font-medium">{next.title}</span>
            </Link>
          )}
        </nav>
      </HelpLayout>
    </>
  );
}
