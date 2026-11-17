import "./site.css";

import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import { SmoothScroll } from "@/components/ui/smooth-scroll";

/** Marketing shell: paper surface, cocoa headings, mauve body. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="site-root min-h-dvh bg-paper text-cocoa">
      <SmoothScroll />
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
    </div>
  );
}
