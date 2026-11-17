import type { ComponentProps, ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

type PanelProps<T extends ElementType> = {
  as?: T;
  className?: string;
  children?: ReactNode;
} & Omit<ComponentProps<T>, "as" | "className" | "children">;

/** Dark translucent app panel (brand/DESIGN.md: bg-panel/85, backdrop blur, line/10 border, radius 20). */
export function Panel<T extends ElementType = "div">({ as, className, children, ...props }: PanelProps<T>) {
  const Tag = (as ?? "div") as ElementType;
  return (
    <Tag className={cn("rounded-xl border border-line/10 bg-panel/85 backdrop-blur-xl", className)} {...props}>
      {children}
    </Tag>
  );
}

/** Panel header row with a label on the left and optional actions on the right. */
export function PanelHeader({ title, id, children, className }: { title: ReactNode; id?: string; children?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-h-12 items-center justify-between gap-3 border-b border-line/10 px-4 py-2.5 sm:px-5", className)}>
      <h2 id={id} className="text-sm font-semibold tracking-tight text-fg">
        {title}
      </h2>
      {children}
    </div>
  );
}
