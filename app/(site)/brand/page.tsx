import type { Metadata } from "next";
import Image from "next/image";
import type { ReactNode } from "react";

import { KondoraLockup, KondoraMark, KondoraWordmark } from "@/components/brand/logo";
import { CopySwatch } from "@/components/brand/copy-swatch";
import { ArrowSquare, buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Brand kit",
  description: "Kondora logo files, colors, type and imagery rules.",
};

const LOGOS = [
  { label: "Lockup, plum on paper", bg: "bg-paper", fg: "text-plum", node: <KondoraLockup className="h-10" title="" />, svg: "kondora-lockup-plum-on-paper.svg", png: "kondora-lockup-plum-on-paper.png" },
  { label: "Lockup, paper on plum", bg: "bg-plum", fg: "text-paper", node: <KondoraLockup className="h-10" title="" />, svg: "kondora-lockup-paper-on-plum.svg", png: "kondora-lockup-paper-on-plum.png" },
  { label: "Lockup, mono", bg: "bg-white", fg: "text-ink", node: <KondoraLockup className="h-10" title="" />, svg: "kondora-lockup-mono.svg", png: "kondora-lockup-mono.png" },
  { label: "Mark, plum", bg: "bg-blush", fg: "text-plum", node: <KondoraMark className="size-20" title="" />, svg: "kondora-mark-plum.svg", png: "kondora-mark-plum.png" },
  { label: "Mark, paper", bg: "bg-cocoa", fg: "text-paper", node: <KondoraMark className="size-20" title="" />, svg: "kondora-mark-paper.svg", png: "kondora-mark-paper.png" },
  { label: "App icon", bg: "bg-blush", fg: "text-paper", node: <span className="grid size-24 place-items-center rounded-xl bg-plum"><KondoraMark className="size-16" title="" /></span>, svg: "kondora-mark-app.svg", png: "kondora-mark-app.png" },
  { label: "Wordmark, plum", bg: "bg-paper", fg: "text-plum", node: <KondoraWordmark className="h-10" title="" />, svg: "kondora-wordmark-plum.svg", png: "kondora-wordmark-plum.png" },
  { label: "Wordmark, paper", bg: "bg-plum", fg: "text-paper", node: <KondoraWordmark className="h-10" title="" />, svg: "kondora-wordmark-paper.svg" },
  { label: "Wordmark, mono", bg: "bg-white", fg: "text-ink", node: <KondoraWordmark className="h-10" title="" />, svg: "kondora-wordmark-mono.svg" },
] as const;

const COLORS = [
  { name: "Paper", hex: "#FFF3F5", use: "Marketing background" },
  { name: "Blush", hex: "#FFDAE0", use: "Soft panels on paper" },
  { name: "Petal", hex: "#FFC7CF", use: "Button squares, highlights" },
  { name: "Petal hot", hex: "#FF8A94", use: "Big numbers on dark, focus" },
  { name: "Acc", hex: "#FFFC8F", use: "The action color" },
  { name: "Plum", hex: "#320713", use: "Primary button, logo", dark: true },
  { name: "Cocoa", hex: "#23050D", use: "Dark cards on paper", dark: true },
  { name: "App bg", hex: "#1B0A0E", use: "App background", dark: true },
  { name: "Mauve", hex: "#7A5E66", use: "Body text on paper", dark: true },
  { name: "Muted", hex: "#A8969B", use: "Secondary text on dark" },
  { name: "Up", hex: "#34D57F", use: "YES and profit" },
  { name: "Down", hex: "#E0344B", use: "NO and loss", dark: true },
] as const;

const IMAGERY = [
  { src: "/art/feature-split.webp", alt: "Split coin render on blush" },
  { src: "/art/cat/crypto.webp", alt: "Crypto category object" },
  { src: "/art/feature-council.webp", alt: "Council orbs render on blush" },
  { src: "/art/cat/world.webp", alt: "World category object" },
] as const;

function Section({ id, title, intro, children }: { id: string; title: string; intro: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-t border-cocoa/10 py-14">
      <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
        <div>
          <h2 id={id} className="text-2xl font-medium tracking-[-0.03em] text-cocoa">{title}</h2>
          <p className="mt-3 text-sm leading-relaxed text-mauve">{intro}</p>
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}

function Download({ file, label }: { file: string; label: string }) {
  return (
    <a href={`/brand/${file}`} download className="rounded-sm px-2 py-1 text-xs font-medium text-cocoa underline decoration-petal-hot underline-offset-2 hover:bg-blush">
      {label}
    </a>
  );
}

export default function BrandPage() {
  return (
    <div className="page-x mx-auto max-w-[72rem] pb-24 pt-14 sm:pt-20">
      <h1 className="text-[clamp(2.75rem,7vw,4.5rem)] font-medium leading-none tracking-[-0.045em] text-cocoa">Brand kit</h1>
      <p className="mt-4 max-w-lg text-mauve">
        Logo files, colors and type for anyone writing about Kondora. Keep it simple: plum on paper, generous space, no effects on the mark.
      </p>

      <div className="mt-12">
        <Section id="logo" title="Logo" intro="The mark is a split coin: two half discs, YES and NO, shifted apart by leverage. Clear space around the logo equals the height of one half disc. Minimum size 16px for the mark, 80px wide for the lockup.">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {LOGOS.map((l) => (
              <li key={l.label} className="overflow-hidden rounded-lg border border-cocoa/10">
                <div className={cn("grid h-40 place-items-center", l.bg, l.fg)}>{l.node}</div>
                <div className="flex flex-wrap items-center justify-between gap-2 bg-white/60 px-3 py-2.5">
                  <span className="text-xs text-mauve">{l.label}</span>
                  <span className="flex gap-1">
                    <Download file={l.svg} label="SVG" />
                    {"png" in l && <Download file={l.png} label="PNG" />}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="color" title="Color" intro="Paper outside, plum inside, one yellow for action. Click a swatch to copy its hex.">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {COLORS.map((c) => (
              <li key={c.name}>
                <CopySwatch name={c.name} hex={c.hex} use={c.use} dark={"dark" in c && c.dark} />
              </li>
            ))}
          </ul>
        </Section>

        <Section id="type" title="Type" intro="Satoshi for everything, from 300 to 900. Geist Mono only for addresses and hashes. Numbers are tabular.">
          <div className="space-y-6 rounded-xl bg-white/60 p-6 sm:p-8">
            <p className="text-[clamp(2.5rem,7vw,4.5rem)] font-bold leading-none tracking-[-0.045em] text-cocoa">Every outcome has a price.</p>
            <p className="text-2xl font-medium tracking-[-0.03em] text-cocoa">Section titles are Satoshi Medium, large and tight.</p>
            <p className="max-w-xl leading-relaxed text-mauve">Body copy is Satoshi Regular in mauve on paper. Short sentences, plain words, no hype.</p>
            <div className="flex flex-wrap items-baseline gap-x-10 gap-y-3 border-t border-cocoa/10 pt-6">
              <span className="text-micro uppercase text-haze">Label, 11px caps</span>
              <span className="num text-3xl text-cocoa">$1,284,300</span>
              <span className="font-mono text-sm text-mauve">9f3c1a...e04b</span>
            </div>
          </div>
        </Section>

        <Section id="buttons" title="Buttons" intro="Radius 10, a petal square with a chevron leads every primary action. Never pill shaped.">
          <div className="flex flex-wrap gap-3 rounded-xl bg-white/60 p-6">
            <span className={buttonClass("dark", "md", undefined, true)}>
              <ArrowSquare />
              Launch app
            </span>
            <span className={buttonClass("light", "md", "border border-cocoa/10", true)}>
              <ArrowSquare />
              Open markets
            </span>
            <span className={buttonClass("accent", "sm")}>+10</span>
          </div>
        </Section>

        <Section id="imagery" title="Imagery" intro="Dreamy pastel 3D: soft blossoms, warm haze, glossy plum and petal objects that carry the split-coin mark. Plain blush backgrounds for objects. Low saturation, light grain. No people, statues, animals or night skies.">
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {IMAGERY.map((img) => (
              <li key={img.src} className="overflow-hidden rounded-lg bg-blush">
                <Image src={img.src} alt={img.alt} width={600} height={600} sizes="(min-width: 1024px) 20vw, 50vw" className="aspect-square w-full object-cover" />
              </li>
            ))}
          </ul>
        </Section>

        <Section id="rules" title="Do and don't" intro="A few rules that keep the brand recognizable.">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-white/60 p-6">
              <h3 className="font-bold text-cocoa">Do</h3>
              <ul className="mt-3 space-y-2 text-sm text-mauve">
                <li>Use plum on paper or paper on plum.</li>
                <li>Keep the two halves of the mark offset exactly as drawn.</li>
                <li>Write the name in lowercase in the logo, Kondora in text.</li>
                <li>Leave clear space equal to one half disc.</li>
              </ul>
            </div>
            <div className="rounded-xl bg-cocoa p-6 text-fg">
              <h3 className="font-bold">Don&apos;t</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted">
                <li>Rotate, stretch, outline or add shadows to the mark.</li>
                <li>Close the gap between the halves or flip the offset.</li>
                <li>Put the logo on busy imagery without a solid panel.</li>
                <li>Use pill shapes, gradients on the logo or other typefaces.</li>
              </ul>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
