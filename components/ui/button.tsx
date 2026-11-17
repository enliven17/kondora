import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Kondora buttons (brand/DESIGN.md).
 * - dark:   plum surface with a petal chevron square, the primary call to action
 * - light:  paper surface with the same square, for use on imagery
 * - accent: electric yellow, for quick actions and confirmations
 * - ghost:  quiet text button
 * - yes/no: trade sides
 * Pass `arrow` to show the petal chevron square.
 */
export type ButtonVariant = "dark" | "light" | "accent" | "ghost" | "outline" | "yes" | "no";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "group/btn inline-flex select-none items-center justify-center gap-2.5 rounded font-semibold transition-[background-color,color,border-color,transform,box-shadow] duration-200 ease-enter active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40";

const variants: Record<ButtonVariant, string> = {
  dark: "bg-plum text-fg hover:bg-cocoa shadow-[0_8px_24px_-12px_rgb(var(--plum)/0.8)]",
  light: "bg-paper text-cocoa hover:bg-white",
  accent: "bg-acc text-acc-ink hover:bg-acc-hover",
  ghost: "text-muted hover:bg-fg/5 hover:text-fg",
  outline: "border border-line/15 text-fg hover:border-line/30 hover:bg-fg/5",
  yes: "bg-up text-ink hover:bg-up/90",
  no: "bg-down text-fg hover:bg-down/90",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-[15px]",
  lg: "h-12 px-5 text-base",
};

const arrowPad: Record<ButtonSize, string> = { sm: "pl-1", md: "pl-1.5", lg: "pl-1.5" };

export function buttonClass(variant: ButtonVariant = "dark", size: ButtonSize = "md", className?: string, arrow = false) {
  return cn(base, variants[variant], sizes[size], arrow && arrowPad[size], className);
}

/** The petal square with a chevron that leads Kondora's primary buttons. */
export function ArrowSquare({ size = "md" }: { size?: ButtonSize }) {
  const box = size === "sm" ? "size-7" : "size-8";
  return (
    <span aria-hidden className={cn("grid shrink-0 place-items-center rounded-sm bg-petal text-plum", box)}>
      <svg viewBox="0 0 16 16" className="size-3.5 transition-transform duration-200 ease-enter group-hover/btn:translate-x-0.5" fill="none">
        <path d="M6 3.5 10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

type ButtonProps = ComponentProps<"button"> & { variant?: ButtonVariant; size?: ButtonSize; arrow?: boolean };

export function Button({ variant, size = "md", className, type = "button", arrow = false, children, ...props }: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, size, className, arrow)} {...props}>
      {arrow && <ArrowSquare size={size} />}
      {children}
    </button>
  );
}

type ButtonLinkProps = Omit<ComponentProps<typeof Link>, "className"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  arrow?: boolean;
  className?: string;
  children: ReactNode;
};

export function ButtonLink({ variant, size = "md", className, arrow = false, children, ...props }: ButtonLinkProps) {
  return (
    <Link className={buttonClass(variant, size, className, arrow)} {...props}>
      {arrow && <ArrowSquare size={size} />}
      {children}
    </Link>
  );
}
