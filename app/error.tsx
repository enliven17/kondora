"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Route error", error);
  }, [error]);

  return (
    <div role="alert" className="page-x mx-auto flex min-h-[70vh] max-w-page flex-col items-center justify-center pt-[var(--header-h)] text-center">
      <p className="micro">Something broke</p>
      <h1 className="mt-3 font-display text-display-sm text-marble-50">We could not load this view.</h1>
      <p className="mt-3 max-w-sm text-marble-400">Your funds are not affected. Try again in a moment.</p>
      <Button className="mt-8" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
