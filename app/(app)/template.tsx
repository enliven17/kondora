"use client";

import { type ReactNode, useEffect, useState } from "react";

/** Subtle fade between app routes (CSS, route-in-app in globals.css). Static on first render so SSR content is never hidden. */
let hasNavigated = false;

export default function AppTemplate({ children }: { children: ReactNode }) {
  const [animateIn] = useState(() => hasNavigated);

  useEffect(() => {
    hasNavigated = true;
  }, []);

  return <div className={animateIn ? "route-in-app" : undefined}>{children}</div>;
}
