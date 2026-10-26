import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Typography — all self-hosted from app/fonts (OFL; see app/fonts/LICENSES.md).
// Nothing is requested from Google Fonts at build or run time.
//
// Display: Archivo variable (wght + wdth) — the wdth axis powers the wide
// display cuts and the kinetic name.
const archivo = localFont({
  src: "./fonts/archivo-wdth.woff2",
  variable: "--font-archivo",
  weight: "100 900",
  display: "swap",
  declarations: [{ prop: "font-stretch", value: "62% 125%" }],
});

// Accent: Mincho-style serif for epigraphs / Japanese-editorial moments only.
const shipporiMincho = localFont({
  src: "./fonts/shippori-mincho-400.woff2",
  variable: "--font-shippori",
  weight: "400",
  display: "swap",
});

// Body: Inter variable.
const inter = localFont({
  src: "./fonts/inter-wght.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

// Utility mono: Server Mono (Internet Development, OFL) — a typewriter-derived
// monospace for timecodes, captions and the typed-list voice of the reference.
const serverMono = localFont({
  src: [
    { path: "./fonts/server-mono.woff2", weight: "400", style: "normal" },
    { path: "./fonts/server-mono-oblique.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-servermono",
  display: "swap",
});

// Formulas (content/formulas.ts): Server Mono and Shippori Mincho are
// Latin-only, so the background's formula blocks list these first. Each holds
// only the Greek letters, sub/superscripts and math symbols the face after it
// lacks, scaled to match it (scripts/asset-tools/formula_fonts.py); the
// unicode-range keeps them out of every other piece of text.
const formulaMono = localFont({
  src: "./fonts/formula-mono.woff2",
  variable: "--font-formula-mono",
  weight: "400",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+0302-0308, U+0391-03F5, U+1D2C-1D6A, U+1FB1, U+2016, U+2032-2033, U+2070-209C, U+2102-2124, U+2190-21D4, U+2200-22A5, U+22C5, U+27E8-27E9, U+2C7C, U+1D53C" }],
});
const formulaSerif = localFont({
  src: "./fonts/formula-serif.woff2",
  variable: "--font-formula-serif",
  weight: "400",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+0302-0308, U+0391-03F5, U+1D2C-1D6A, U+1FB1, U+2016, U+2032-2033, U+2070-209C, U+2102-2124, U+2190-21D4, U+2200-22A5, U+22C5, U+27E8-27E9, U+2C7C, U+1D53C" }],
});
// what neither of the two above has (← ∇ √ ≤ …), for both blocks
const formulaSymbols = localFont({
  src: "./fonts/formula-symbols.woff2",
  variable: "--font-formula-symbols",
  weight: "400",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+0302-0308, U+0391-03F5, U+1D2C-1D6A, U+1FB1, U+2016, U+2032-2033, U+2070-209C, U+2102-2124, U+2190-21D4, U+2200-22A5, U+22C5, U+27E8-27E9, U+2C7C, U+1D53C" }],
});

// SEO Metadata (§16)
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://keffer.cafe"),
  title: "William Keffer — Computer Science × Mathematics × Machine Learning",
  description:
    "Portfolio of William Keffer. Junior at UNC Chapel Hill pursuing Computer Science and Mathematics. Research in adversarial machine learning, VLM security, and satellite-economic analysis.",
  openGraph: {
    title: "William Keffer — Portfolio",
    description:
      "Computer Science × Mathematics × Machine Learning. Research in adversarial ML, VLM security, and satellite-economic analysis.",
    type: "website",
    locale: "en_US",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "William Keffer — SIGNAL/NOISE portfolio" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "William Keffer — Portfolio",
    description: "Computer Science × Mathematics × Machine Learning",
    images: ["/og.jpg"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${shipporiMincho.variable} ${inter.variable} ${serverMono.variable} ${formulaMono.variable} ${formulaSerif.variable} ${formulaSymbols.variable}`}
    >
      <body className="antialiased">
        {/* Skip to content link for accessibility (§15) */}
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
