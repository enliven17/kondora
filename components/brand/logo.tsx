import type { SVGProps } from "react";

import { cn } from "@/lib/utils";
import { LOCKUP, MARK_BOTTOM, MARK_TOP, WORDMARK_GLYPHS, WORDMARK_HEIGHT, WORDMARK_WIDTH } from "./logo-paths";

export { MARK_BOTTOM, MARK_TOP, WORDMARK_GLYPHS, WORDMARK_HEIGHT, WORDMARK_WIDTH };

type SvgProps = Omit<SVGProps<SVGSVGElement>, "children"> & { title?: string };

/** a11y: a labelled image by default, or fully hidden when `title` is empty. */
function a11y(title: string) {
  return title ? { role: "img" as const, "aria-label": title } : { "aria-hidden": true as const };
}

/** The split coin: two half discs offset horizontally (YES and NO, shifted by leverage). */
export function KondoraMark({ className, title = "Kondora", ...props }: SvgProps) {
  return (
    <svg viewBox="0 0 64 64" className={cn("size-8", className)} fill="currentColor" {...a11y(title)} {...props}>
      <path d={MARK_TOP} />
      <path d={MARK_BOTTOM} />
    </svg>
  );
}

/** Lowercase "kondora" in Satoshi Bold, as outlines. */
export function KondoraWordmark({ className, title = "Kondora", ...props }: SvgProps) {
  return (
    <svg
      viewBox={`0 0 ${WORDMARK_WIDTH} ${WORDMARK_HEIGHT}`}
      className={cn("h-5 w-auto", className)}
      fill="currentColor"
      {...a11y(title)}
      {...props}
    >
      <path d={WORDMARK_GLYPHS.join(" ")} />
    </svg>
  );
}

/** Mark and wordmark on one baseline box. Set the height; width follows. */
export function KondoraLockup({ className, title = "Kondora", ...props }: SvgProps) {
  return (
    <svg
      viewBox={`0 0 ${LOCKUP.width} ${WORDMARK_HEIGHT}`}
      className={cn("h-6 w-auto", className)}
      fill="currentColor"
      {...a11y(title)}
      {...props}
    >
      <g transform={`scale(${LOCKUP.markScale}) translate(-5 -7)`}>
        <path d={MARK_TOP} />
        <path d={MARK_BOTTOM} />
      </g>
      <path transform={`translate(${LOCKUP.wordX} 0)`} d={WORDMARK_GLYPHS.join(" ")} />
    </svg>
  );
}
