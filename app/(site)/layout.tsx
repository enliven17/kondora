import "./site.css";

import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";

/** Marketing shell: paper surface, cocoa headings, mauve body. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="site-root min-h-dvh bg-paper text-cocoa">
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
    </div>
  );
}
