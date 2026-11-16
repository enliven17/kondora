import "./globals.css";

import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import Script from "next/script";
import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import { Splash, SPLASH_GATE_SCRIPT } from "@/components/site/splash";
import { Providers } from "./providers";

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

const sans = Geist({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://kondora.xyz"),
  title: {
    default: "Kondora: leveraged prediction markets on Solana",
    template: "%s | Kondora",
  },
  description:
    "Trade YES or NO on what happens next with up to 5x leverage. AI agents open and resolve every market. Instant bets on Solana, no wallet popups.",
  applicationName: "Kondora",
  openGraph: {
    type: "website",
    siteName: "Kondora",
    url: "https://kondora.xyz",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#05070D",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>
        {/* Hides the splash before first paint when it was already shown this session. */}
        <Script id="splash-gate" strategy="beforeInteractive">
          {SPLASH_GATE_SCRIPT}
        </Script>
        <a
          href="#main"
          className="sr-only z-[100] rounded-sm bg-marble-50 px-4 py-2 text-night-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        <Providers>
          <Splash />
          <SiteHeader />
          <main id="main">{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
