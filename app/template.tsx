"use client";

import { type ReactNode, useEffect, useState } from "react";

/**
 * Route transition: fade and lift on client navigations. A CSS keyframe (route-in, globals.css)
 * instead of motion, so pages that don't animate ship no animation library; the transform clears
 * at rest, so fixed and sticky children behave.
 * The very first render (SSR and hydration) is static so content is never hidden before JS.
 */
let hasNavigated = false;

export default function Template({ children }: { children: ReactNode }) {
  const [animateIn] = useState(() => hasNavigated);

  useEffect(() => {
    hasNavigated = true;
  }, []);

  return <div className={animateIn ? "route-in" : undefined}>{children}</div>;
}
