"use client";

/*
 * Adapted from the CankatUI registry (animated-tabs).
 * Base UI Tabs replaced with a native WAI-ARIA tablist (roving tabindex, arrow keys,
 * Home/End) so the component has no extra dependency. Shared indicator via motion layoutId.
 */

import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { type KeyboardEvent, type ReactNode, useId, useRef } from "react";

import { motionTransition } from "@/lib/motion";
import { cn } from "@/lib/utils";

export interface AnimatedTabItem {
  value: string;
  title: ReactNode;
  disabled?: boolean;
  /** ID of the panel this tab controls. */
  ariaControls?: string;
}

export interface AnimatedTabsProps {
  tabs: AnimatedTabItem[];
  value: string;
  onValueChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
  listClassName?: string;
  tabClassName?: string;
  indicatorClassName?: string;
}

export default function AnimatedTabs({
  tabs,
  value,
  onValueChange,
  ariaLabel,
  className,
  listClassName,
  tabClassName,
  indicatorClassName,
}: AnimatedTabsProps) {
  const layoutId = useId();
  const reduce = useReducedMotion();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const enabled = tabs.map((t, i) => (t.disabled ? -1 : i)).filter((i) => i >= 0);

  const focusIndex = (index: number) => {
    const tab = tabs[index];
    if (!tab) return;
    refs.current[index]?.focus();
    onValueChange(tab.value);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const pos = enabled.indexOf(index);
    let next: number | undefined;
    if (event.key === "ArrowRight") next = enabled[(pos + 1) % enabled.length];
    else if (event.key === "ArrowLeft") next = enabled[(pos - 1 + enabled.length) % enabled.length];
    else if (event.key === "Home") next = enabled[0];
    else if (event.key === "End") next = enabled[enabled.length - 1];
    if (next === undefined) return;
    event.preventDefault();
    focusIndex(next);
  };

  return (
    <div className={cn("relative max-w-full overflow-x-auto", className)}>
      <LayoutGroup id={layoutId}>
        <div role="tablist" aria-label={ariaLabel} aria-orientation="horizontal" className={cn("flex w-max gap-1", listClassName)}>
          {tabs.map((tab, index) => {
            const active = tab.value === value;
            return (
              <button
                key={tab.value}
                ref={(el) => {
                  refs.current[index] = el;
                }}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={tab.ariaControls}
                tabIndex={active ? 0 : -1}
                disabled={tab.disabled}
                onClick={() => onValueChange(tab.value)}
                onKeyDown={(e) => onKeyDown(e, index)}
                className={cn(
                  "relative flex shrink-0 cursor-pointer items-center rounded-sm px-3 py-2 text-sm transition-colors duration-200",
                  "disabled:pointer-events-none disabled:opacity-40",
                  active ? "text-night-950" : "text-marble-400 hover:text-marble-50",
                  tabClassName,
                )}
              >
                {active && (
                  <motion.span
                    aria-hidden="true"
                    layoutId={`${layoutId}-active`}
                    className={cn("pointer-events-none absolute inset-0 rounded-sm bg-marble-50", indicatorClassName)}
                    transition={reduce ? motionTransition.reduced : motionTransition.spatial}
                  />
                )}
                <span className="relative">{tab.title}</span>
              </button>
            );
          })}
        </div>
      </LayoutGroup>
    </div>
  );
}
