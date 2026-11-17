import Image from "next/image";

import { ButtonLink } from "@/components/ui/button";

export function ClosingCta() {
  return (
    <section aria-labelledby="cta-title" className="px-3 pb-6 sm:px-5 sm:pb-8">
      <div className="relative isolate mx-auto grid min-h-[420px] max-w-[110rem] place-items-center overflow-hidden rounded-2xl bg-plum px-6 py-20 text-center sm:min-h-[520px]">
        <Image
          src="/art/cta.webp"
          alt=""
          fill
          sizes="100vw"
          quality={75}
          className="-z-10 object-cover"
        />
        <div aria-hidden className="absolute inset-0 -z-10 bg-ink/45" />
        <div>
          <h2 id="cta-title" className="text-[clamp(2.5rem,7vw,5rem)] font-bold leading-none tracking-[-0.045em] text-fg">
            Pick a side
          </h2>
          <p className="mx-auto mt-4 max-w-sm text-fg/80">A hundred live markets, from tonight&apos;s match to next month&apos;s rate call.</p>
          <ButtonLink href="/markets" variant="light" arrow className="mt-7">
            Open markets
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
