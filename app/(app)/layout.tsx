import "./app.css";

import type { ReactNode } from "react";

import { AppBackdrop } from "@/components/app/app-backdrop";
import { AppHeader } from "@/components/app/app-header";
import { StatsRibbon } from "@/components/app/stats-ribbon";
import { StatusBar } from "@/components/app/status-bar";
import { getSearchIndex, getStats } from "@/lib/data";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const [stats, searchItems] = await Promise.all([getStats(), getSearchIndex()]);

  return (
    <>
      <AppBackdrop />
      <AppHeader searchItems={searchItems} />
      <StatsRibbon stats={stats} />
      <main id="main" className="mx-auto w-full max-w-[100rem] px-3 pb-[calc(var(--app-status-h)+2rem)] pt-4 sm:px-5 sm:pt-6">
        {children}
      </main>
      <StatusBar />
    </>
  );
}
