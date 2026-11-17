import { CATEGORY_META, CATEGORY_TINT } from "@/lib/categories";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Category render as a CSS background over its gradient, so a missing file never shows a broken image.
 * Decorative: the category name is always printed next to it.
 */
export function CategoryThumb({ category, className }: { category: Category; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("block shrink-0 overflow-hidden rounded-md border border-line/10 bg-cover bg-center", className)}
      style={{ backgroundImage: `url("${CATEGORY_META[category].cover}"), ${CATEGORY_TINT[category]}` }}
    />
  );
}
