"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { type CSSProperties, type ReactNode, useRef } from "react";

import { ART_LAYERS, type ArtLayerName } from "@/lib/art-layers";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export interface SceneLayer {
  /** Layer file in public/art/layers. */
  name: ArtLayerName;
  /**
   * 0 = pinned to the far background, 1 = nearest the viewer.
   * Controls scroll speed, pointer shift and translateZ.
   */
  depth: number;
  /** Positioning and size, e.g. "right-0 bottom-0 w-[46%]". */
  className?: string;
  style?: CSSProperties;
  /** Light-on-dark elements can blend into the sky. */
  blend?: "screen" | "normal";
  /** Slow idle drift (condor glide, cloud wander). */
  float?: "glide" | "drift";
  /** Loading priority for above-the-fold layers. */
  priority?: boolean;
  /** Fill the whole stage (opaque backdrops like the sky). */
  cover?: boolean;
}

export interface ParallaxSceneProps {
  layers: SceneLayer[];
  className?: string;
  /** Scroll distance multiplier in percent of scene height. */
  scrollRange?: number;
  /** Max pointer shift in px for depth 1. */
  pointerRange?: number;
  /** Max tilt in degrees for the whole scene. */
  tilt?: number;
  /** "auto" scrubs each layer by depth over the scene; "external" leaves scroll to the parent timeline. */
  scroll?: "auto" | "external";
  /** Rendered between layers at this index (e.g. a starfield canvas). */
  insertAt?: { index: number; node: ReactNode };
  children?: ReactNode;
}

function Layer({ layer }: { layer: SceneLayer }) {
  const meta = ART_LAYERS[layer.name];
  const base = `/art/layers/${layer.name}`;
  return (
    <div
      data-depth={layer.depth}
      data-float={layer.float}
      className={cn("pointer-events-none absolute will-change-transform", layer.cover && "inset-0", layer.className)}
      style={{
        ...layer.style,
        mixBlendMode: layer.blend === "screen" ? "screen" : undefined,
        transform: `translateZ(${Math.round(layer.depth * 60)}px)`,
      }}
    >
      <picture className={layer.cover ? "block h-full w-full" : "block"}>
        <source srcSet={`${base}.avif`} type="image/avif" />
        <source srcSet={`${base}.webp`} type="image/webp" />
        <img
          src={`${base}.png`}
          alt=""
          width={meta.width}
          height={meta.height}
          loading={layer.priority ? "eager" : "lazy"}
          fetchPriority={layer.priority ? "high" : "auto"}
          decoding="async"
          draggable={false}
          className={cn("block select-none", layer.cover ? "h-full w-full object-cover" : "h-auto w-full")}
        />
      </picture>
    </div>
  );
}

/**
 * Layered parallax collage. Each layer moves at its own speed on scroll and shifts
 * slightly with the pointer; the scene tilts in 3D. Static under prefers-reduced-motion.
 * Decorative: everything is aria-hidden.
 */
export function ParallaxScene({
  layers,
  className,
  scrollRange = 30,
  scroll = "auto",
  pointerRange = 28,
  tilt = 2.5,
  insertAt,
  children,
}: ParallaxSceneProps) {
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const els = gsap.utils.toArray<HTMLElement>("[data-depth]", root.current);

        // Scroll: deeper layers move less, near layers move more.
        if (scroll === "auto") els.forEach((el) => {
          const depth = Number(el.dataset.depth);
          gsap.to(el, {
            yPercent: -scrollRange * depth,
            ease: "none",
            scrollTrigger: { trigger: root.current, start: "top bottom", end: "bottom top", scrub: 0.6 },
          });
        });

        // Idle motion.
        els
          .filter((el) => el.dataset.float)
          .forEach((el, i) => {
            const glide = el.dataset.float === "glide";
            const inner = el.querySelector("img");
            if (!inner) return;
            gsap.to(inner, {
              x: glide ? 40 : 24,
              y: glide ? -14 : 6,
              rotate: glide ? -2 : 0,
              duration: glide ? 7 : 11 + i * 2,
              ease: "sine.inOut",
              yoyo: true,
              repeat: -1,
            });
          });

        // Pointer: shift by depth, tilt the stage. Fine pointers only.
        if (!window.matchMedia("(pointer: fine)").matches || !stage.current) return;
        const movers = els.map((el) => {
          const depth = Number(el.dataset.depth);
          const picture = el.querySelector("picture") as HTMLElement;
          return {
            depth,
            x: gsap.quickTo(picture, "x", { duration: 0.9, ease: "power3.out" }),
            y: gsap.quickTo(picture, "y", { duration: 0.9, ease: "power3.out" }),
          };
        });
        const rx = gsap.quickTo(stage.current, "rotationX", { duration: 1.2, ease: "power3.out" });
        const ry = gsap.quickTo(stage.current, "rotationY", { duration: 1.2, ease: "power3.out" });

        const onMove = (e: PointerEvent) => {
          const nx = e.clientX / window.innerWidth - 0.5;
          const ny = e.clientY / window.innerHeight - 0.5;
          movers.forEach((m) => {
            m.x(-nx * pointerRange * m.depth);
            m.y(-ny * pointerRange * 0.6 * m.depth);
          });
          ry(nx * tilt);
          rx(-ny * tilt);
        };
        window.addEventListener("pointermove", onMove, { passive: true });
        return () => window.removeEventListener("pointermove", onMove);
      });
      return () => mm.revert();
    },
    { scope: root, dependencies: [scrollRange, pointerRange, tilt, scroll] },
  );

  return (
    <div ref={root} aria-hidden="true" className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)} style={{ perspective: "1200px" }}>
      <div ref={stage} className="absolute inset-[-3%]" style={{ transformStyle: "preserve-3d" }}>
        {layers.map((layer, i) => (
          <SceneSlot key={`${layer.name}-${i}`} insert={insertAt?.index === i ? insertAt.node : null}>
            <Layer layer={layer} />
          </SceneSlot>
        ))}
        {children}
      </div>
    </div>
  );
}

function SceneSlot({ insert, children }: { insert: ReactNode; children: ReactNode }) {
  return (
    <>
      {insert}
      {children}
    </>
  );
}
