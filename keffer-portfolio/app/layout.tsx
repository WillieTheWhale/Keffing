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
      className={`${archivo.variable} ${shipporiMincho.variable} ${inter.variable} ${serverMono.variable}`}
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
