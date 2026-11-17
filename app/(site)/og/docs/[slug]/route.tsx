import { renderOg } from "@/components/brand/og";
import { DEFAULT_DOC, getAllDocs, getDoc } from "@/components/docs/content";

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllDocs().map((d) => ({ slug: d.slug }));
}

/** Per-page share image for docs (an optional catch-all route cannot host opengraph-image). */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = getDoc(slug) ?? getDoc(DEFAULT_DOC);
  return renderOg({ eyebrow: `Docs / ${doc?.section ?? "Kondora"}`, title: doc?.title ?? "Docs", subtitle: doc?.description, theme: "paper" });
}
