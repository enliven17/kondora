import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DEFAULT_DOC, docHref, getAllDocs, getDoc, getDocNav } from "@/components/docs/content";
import { Markdown } from "@/components/docs/markdown";
import { DocsSidebar } from "@/components/docs/sidebar";
import { DocsToc } from "@/components/docs/toc";

type Props = { params: Promise<{ slug?: string[] }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllDocs().map((d) => ({ slug: d.slug === DEFAULT_DOC ? [] : [d.slug] }));
}

function resolve(slug?: string[]) {
  if (!slug || slug.length === 0) return getDoc(DEFAULT_DOC);
  if (slug.length !== 1 || slug[0] === DEFAULT_DOC) return null;
  return getDoc(slug[0] as string);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const doc = resolve((await params).slug);
  if (!doc) return {};
  return {
    title: doc.slug === DEFAULT_DOC ? "Docs" : doc.title,
    description: doc.description,
    alternates: { canonical: docHref(doc.slug) },
    openGraph: { title: doc.title, description: doc.description, images: [{ url: `/og/docs/${doc.slug}`, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", images: [`/og/docs/${doc.slug}`] },
  };
}

export default async function DocPage({ params }: Props) {
  const doc = resolve((await params).slug);
  if (!doc) notFound();

  const all = getAllDocs();
  const index = all.findIndex((d) => d.slug === doc.slug);
  const prev = all[index - 1];
  const next = all[index + 1];
  const groups = getDocNav().map((g) => ({
    section: g.section,
    docs: g.docs.map((d) => ({ href: docHref(d.slug), title: d.title })),
  }));

  return (
    <div className="page-x mx-auto grid max-w-page gap-x-12 lg:grid-cols-[14rem_minmax(0,1fr)] xl:grid-cols-[14rem_minmax(0,1fr)_13rem]">
      <aside className="lg:pt-14">
        <DocsSidebar groups={groups} current={doc.title} />
      </aside>

      <article className="mx-auto w-full max-w-[44rem] pb-24 pt-10 lg:pt-16">
        <p className="text-micro uppercase text-haze">{doc.section}</p>
        <h1 className="mt-3 text-[clamp(2rem,4.5vw,2.75rem)] font-bold leading-[1.08] tracking-[-0.035em] text-cocoa">{doc.title}</h1>
        {doc.description && <p className="mt-4 text-lg leading-relaxed text-mauve">{doc.description}</p>}
        <div className="mt-10">
          <Markdown source={doc.body} />
        </div>

        <nav aria-label="Pagination" className="mt-16 grid gap-3 border-t border-cocoa/10 pt-8 sm:grid-cols-2">
          {prev ? (
            <Link href={docHref(prev.slug)} className="group rounded-lg border border-cocoa/10 p-4 transition-colors hover:bg-blush/60">
              <span className="text-xs text-haze">Previous</span>
              <span className="mt-1 block font-medium text-cocoa">{prev.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next && (
            <Link href={docHref(next.slug)} className="group rounded-lg border border-cocoa/10 p-4 text-right transition-colors hover:bg-blush/60">
              <span className="text-xs text-haze">Next</span>
              <span className="mt-1 block font-medium text-cocoa">{next.title}</span>
            </Link>
          )}
        </nav>
      </article>

      <aside className="hidden pt-16 xl:block">
        <DocsToc headings={doc.headings} />
      </aside>
    </div>
  );
}
