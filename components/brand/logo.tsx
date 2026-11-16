import type { SVGProps } from "react";
import { cn } from "@/lib/utils";

/** Geometry shared with brand/logo/*.svg. Keep in sync. */
export const MARK_PATH =
  "M32 13 L35.6 19.4 L62 12 L56 19.5 L60.5 20.5 L53 25.5 L56.5 27.5 L45.5 30 L37.5 35.5 L32 47 L26.5 35.5 L18.5 30 L7.5 27.5 L11 25.5 L3.5 20.5 L8 19.5 L2 12 L28.4 19.4 Z M27.6 22.4 L32 25.6 L36.4 22.4 L36.4 24.6 L32 27.8 L27.6 24.6 Z";

export const WORDMARK_STROKES = [
  "M1.75 0V40 M26 0 L4 22 M11 14.5 L28 40",
  "M95.75 40V0 L120.25 40V0",
  "M139.75 1.75 H149 A18.25 18.25 0 0 1 149 38.25 H139.75 Z",
  "M235.75 40V1.75 H249.5 A9.6 9.6 0 0 1 249.5 21 H235.75 M248 21 L261 40",
  "M277 40 L293 0 L309 40 M283.4 26 H302.6",
] as const;

export const WORDMARK_O_CENTERS = [61, 201] as const;

type SvgProps = Omit<SVGProps<SVGSVGElement>, "children"> & { title?: string };

export function KondoraMark({ className, title = "Kondora", ...props }: SvgProps) {
  return (
    <svg viewBox="0 0 64 64" role="img" aria-label={title} className={cn("h-8 w-8", className)} {...props}>
      <path fill="currentColor" fillRule="evenodd" transform="translate(0 2.5)" d={MARK_PATH} />
    </svg>
  );
}

export function KondoraWordmark({ className, title = "Kondora", strokeWidth = 3.5, ...props }: SvgProps) {
  return (
    <svg viewBox="-2 -2 314 44" role="img" aria-label={title} className={cn("h-4 w-auto", className)} fill="none" {...props}>
      <g stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="miter" strokeMiterlimit={1.5}>
        {WORDMARK_STROKES.map((d) => (
          <path key={d} d={d} />
        ))}
        {WORDMARK_O_CENTERS.map((cx) => (
          <ellipse key={cx} cx={cx} cy={20} rx={15.25} ry={18.25} />
        ))}
      </g>
    </svg>
  );
}

export function KondoraLockup({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <KondoraMark className="h-7 w-7" title="" aria-hidden />
      <KondoraWordmark className="h-[13px]" strokeWidth={4} />
    </span>
  );
}
