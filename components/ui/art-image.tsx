import type { ImgHTMLAttributes } from "react";

/**
 * Static art with a hand-made srcset. Image optimization is off (`images.unoptimized`, free plan),
 * so next/image would only emit `src`; the smaller widths are pre-built next to the original as
 * `<name>-<width>.webp` and the original is the largest candidate.
 */
export function artSrcSet(src: string, width: number, widths: readonly number[]): string {
  const stem = src.replace(/\.webp$/, "");
  return [...widths.filter((w) => w < width).map((w) => `${stem}-${w}.webp ${w}w`), `${src} ${width}w`].join(", ");
}

export interface ArtImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet" | "width" | "height" | "sizes"> {
  src: string;
  alt: string;
  /** Intrinsic size of the original file. */
  width: number;
  height: number;
  /** Pre-built smaller widths that exist as `<name>-<w>.webp`. */
  widths: readonly number[];
  sizes: string;
  /** LCP art only: eager, high fetch priority. Everything else lazy loads. */
  priority?: boolean;
}

export function ArtImage({ src, alt, width, height, widths, sizes, priority = false, ...rest }: ArtImageProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- pre-sized static art, optimizer is off on purpose
    <img
      src={src}
      srcSet={artSrcSet(src, width, widths)}
      sizes={sizes}
      alt={alt}
      width={width}
      height={height}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding={priority ? "sync" : "async"}
      {...rest}
    />
  );
}
