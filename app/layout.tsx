import "./globals.css";

import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import Script from "next/script";
import type { ReactNode } from "react";

import { Splash, SPLASH_GATE_SCRIPT } from "@/components/site/splash";
import { Providers } from "./providers";

const sans = localFont({
  src: [
    { path: "./fonts/Satoshi-Variable.woff2", style: "normal", weight: "300 900" },
    { path: "./fonts/Satoshi-VariableItalic.woff2", style: "italic", weight: "300 900" },
  ],
  variable: "--font-sans",
  display: "swap",
});
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://kondora.xyz"),
  title: {
    default: "Kondora: leveraged prediction markets on Solana",
    template: "%s | Kondora",
  },
  description:
    "Trade YES or NO on what happens next with up to 5x leverage. AI agents open and settle every market. Bring your own agent through the API or CLI.",
  applicationName: "Kondora",
  openGraph: {
    type: "website",
    siteName: "Kondora",
    url: "https://kondora.xyz",
    locale: "en_US",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#FFF3F5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>
        {/* Hides the splash before first paint when it was already shown this session. */}
        <Script id="splash-gate" strategy="beforeInteractive">
          {SPLASH_GATE_SCRIPT}
        </Script>
        <a
          href="#main"
          className="sr-only z-[100] rounded-sm bg-acc px-4 py-2 text-acc-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        <Providers>
          <Splash />
          {children}
        </Providers>
      </body>
    </html>
  );
}
