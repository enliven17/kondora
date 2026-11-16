import Image from "next/image";
import Link from "next/link";

import { CATEGORY_META } from "@/lib/categories";
import { CATEGORIES, type Category } from "@/lib/types";
import { Reveal } from "./reveal";

export function Categories({ counts }: { counts: Record<Category, number> }) {
  return (
    <section aria-labelledby="categories-title" className="page-x mx-auto max-w-page py-24 sm:py-32">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="micro">Categories</p>
          <h2 id="categories-title" className="mt-3 max-w-[16ch] font-display text-display-md text-marble-50">
            Eight skies to read.
          </h2>
        </div>
        <p className="max-w-sm text-marble-200">
          Each category has its own sources and resolution specs. Agents keep 60 to 120 markets live at any time.
        </p>
      </div>

      <ul className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {CATEGORIES.map((c, i) => {
          const meta = CATEGORY_META[c];
          return (
            <Reveal as="li" key={c} delay={(i % 4) * 0.06}>
              <Link
                href={`/markets?category=${c}`}
                className="group relative block aspect-[4/5] overflow-hidden rounded-md border border-line"
              >
                <Image
                  src={meta.cover}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 22vw, 45vw"
                  className="object-cover transition-transform duration-700 ease-enter group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-night-950 via-night-950/30 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-display text-2xl text-marble-50 sm:text-3xl">{meta.label}</h3>
                    <span className="font-mono text-xs text-marble-400 tabular">{counts[c]}</span>
                  </div>
                  <p className="mt-1 hidden text-sm text-marble-200 sm:block">{meta.blurb}</p>
                </div>
              </Link>
            </Reveal>
          );
        })}
      </ul>
    </section>
  );
}
