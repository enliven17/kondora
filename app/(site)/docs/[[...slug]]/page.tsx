import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { DEFAULT_DOC, docHref, getAllDocs, getDoc, getDocNav, getDocSearch } from "@/components/docs/content";
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
  const readingMinutes = Math.max(1, Math.ceil(doc.body.split(/\s+/).length / 200));

  return (
    <div className="page-x mx-auto grid max-w-page grid-cols-[minmax(0,1fr)] gap-x-8 lg:grid-cols-[13rem_minmax(0,1fr)] xl:grid-cols-[13rem_minmax(0,1fr)_12rem] xl:gap-x-10">
      <aside className="sticky top-16 z-30 lg:static lg:z-auto lg:pt-14">
        <DocsSidebar groups={groups} current={doc.title} entries={getDocSearch()} />
      </aside>

      <article className="mx-auto min-w-0 w-full max-w-[48rem] pb-24 pt-10 lg:pt-16">
        <nav aria-label="Breadcrumb" className="mb-7 flex flex-wrap items-center gap-2 text-xs text-mauve">
          <Link href="/docs" className="hover:text-cocoa">Docs</Link>
          <span aria-hidden>/</span>
          <span>{doc.section}</span>
        </nav>
        <div className="flex items-center justify-between gap-4">
          <p className="text-micro uppercase text-mauve">{doc.section}</p>
          <span className="text-xs text-mauve">{readingMinutes} min read</span>
        </div>
        <h1 className="mt-3 text-[clamp(2rem,4.5vw,2.75rem)] font-bold leading-[1.08] tracking-[-0.035em] text-cocoa">{doc.title}</h1>
        {doc.description && <p className="mt-4 text-lg leading-relaxed text-mauve">{doc.description}</p>}
        {doc.slug === DEFAULT_DOC && (
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              { href: "/docs/quick-start", label: "Make your first trade", detail: "Wallet, test funds, and your first position." },
              { href: "/docs/how-it-works", label: "Understand the protocol", detail: "Follow a market from creation to payout." },
              { href: "/docs/agents", label: "Build a trading agent", detail: "Connect your strategy with the CLI or API." },
              { href: "/docs/troubleshooting", label: "Find an answer", detail: "Fix wallet, balance, and transaction issues." },
            ].map((item) => (
              <Link key={item.href} href={item.href} className="group rounded-lg border border-cocoa/10 bg-paper p-5 transition-colors hover:border-plum/30 hover:bg-blush/40">
                <span className="flex items-center justify-between gap-2 text-sm font-bold text-cocoa">{item.label}<span aria-hidden className="text-mauve transition-transform group-hover:translate-x-1">↗</span></span>
                <span className="mt-2 block text-sm leading-relaxed text-mauve">{item.detail}</span>
              </Link>
            ))}
          </div>
        )}
        {doc.headings.length > 0 && (
          <details className="mt-8 rounded-lg border border-cocoa/10 px-4 py-3 xl:hidden">
            <summary className="cursor-pointer text-sm font-medium text-cocoa">On this page</summary>
            <ul className="mt-3 space-y-2 pb-1">
              {doc.headings.map((heading) => <li key={heading.id} className={heading.depth === 3 ? "pl-3" : ""}><a href={`#${heading.id}`} className="text-sm text-mauve hover:text-cocoa">{heading.text}</a></li>)}
            </ul>
          </details>
        )}
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
        <a href={`https://github.com/enliven17/kondora/blob/main/content/docs/${doc.slug}.md`} target="_blank" rel="noreferrer" className="mt-6 inline-block text-xs text-mauve underline decoration-cocoa/20 underline-offset-4 hover:text-cocoa">View this page on GitHub ↗</a>
      </article>

      <aside className="hidden pt-16 xl:block">
        <DocsToc headings={doc.headings} />
      </aside>
    </div>
  );
}
