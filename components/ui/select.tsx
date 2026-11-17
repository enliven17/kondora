"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

interface Option<T extends string> {
  value: T;
  label: string;
  count?: number;
  icon?: string;
}

/** Select-only combobox. The portal keeps the menu outside clipped panels. */
export function Select<T extends string>({ label, value, options, onChange, align = "start" }: {
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  align?: "start" | "end";
}) {
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const search = useRef({ text: "", at: 0 });
  const [position, setPosition] = useState<CSSProperties | null>(null);
  const [active, setActive] = useState(0);
  const selected = options.findIndex(option => option.value === value);
  const current = options[selected] ?? options[0];
  const open = position !== null;

  const show = (index = Math.max(0, selected)) => {
    const rect = trigger.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(Math.max(rect.width, 224), window.innerWidth - 24);
    const below = window.innerHeight - rect.bottom;
    const above = rect.top;
    const down = below >= 380 || below >= above;
    setPosition({
      left: Math.max(12, Math.min(align === "end" ? rect.right - width : rect.left, window.innerWidth - width - 12)),
      width,
      maxHeight: Math.min(380, Math.max(100, (down ? below : above) - 20)),
      ...(down ? { top: rect.bottom + 8 } : { bottom: window.innerHeight - rect.top + 8 }),
    });
    setActive(index);
  };

  const choose = (index: number) => {
    onChange(options[index].value);
    setPosition(null);
    trigger.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!trigger.current?.contains(event.target as Node) && !menu.current?.contains(event.target as Node)) setPosition(null);
    };
    const close = (event: Event) => {
      if (!menu.current?.contains(event.target as Node)) setPosition(null);
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  useEffect(() => {
    if (open) menu.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "Tab" || event.key === "Escape") {
      if (open && event.key === "Escape") event.preventDefault();
      setPosition(null);
    } else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const index = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1
        : open ? (active + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length
        : Math.max(0, selected);
      if (open) setActive(index);
      else show(index);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) choose(active);
      else show();
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now();
      search.current = { text: (now - search.current.at < 700 ? search.current.text : "") + event.key.toLowerCase(), at: now };
      const index = options.findIndex(option => option.label.toLowerCase().startsWith(search.current.text));
      if (index >= 0) { event.preventDefault(); if (open) setActive(index); else show(index); }
    }
  };

  return <>
    <button ref={trigger} type="button" role="combobox" aria-label={label} aria-haspopup="listbox"
      aria-expanded={open} aria-controls={open ? id : undefined} aria-activedescendant={open ? `${id}-${active}` : undefined}
      onClick={() => open ? setPosition(null) : show()} onKeyDown={onKeyDown} onBlur={() => setPosition(null)}
      className={cn("inline-flex h-9 min-w-0 max-w-full items-center gap-2 rounded-sm px-1 text-sm font-semibold text-cocoa transition-colors hover:bg-cocoa/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-cocoa/60", open && "bg-cocoa/[0.06]")}>
      <span className="truncate">{current.label}{current.count !== undefined && ` (${current.count})`}</span>
      <svg viewBox="0 0 16 16" aria-hidden="true" className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} fill="none">
        <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
    {position && createPortal(
      <div ref={menu} id={id} role="listbox" aria-label={label} style={position}
        className="fixed z-[100] overflow-y-auto overscroll-contain rounded-lg border border-blush/20 bg-panel p-1.5 text-sm shadow-[0_12px_40px_rgba(0,0,0,0.4)]">
        {options.map((option, index) => <div key={option.value} id={`${id}-${index}`} role="option" aria-selected={option.value === value}
          onPointerMove={() => setActive(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(index)}
          className={cn("flex min-h-10 cursor-pointer items-center gap-2.5 rounded px-2.5 py-2 transition-colors", option.value === value ? "bg-blush/10 text-blush" : "text-fg/85", active === index && "bg-blush/[0.15] text-fg")}>
          {option.icon && <Image src={option.icon} alt="" width={24} height={24} className="size-6 rounded-xs" />}
          <span className="flex-1 font-medium">{option.label}</span>
          {option.count !== undefined && <span className="num min-w-6 rounded-xs bg-fg/5 px-1.5 py-0.5 text-center text-xs text-muted">{option.count}</span>}
          <span className="flex size-4 items-center justify-center text-blush" aria-hidden="true">
            {option.value === value && <svg viewBox="0 0 16 16" fill="none"><path d="m3 8 3 3 7-7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </span>
        </div>)}
      </div>, document.body,
    )}
  </>;
}
