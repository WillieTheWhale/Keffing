import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Typography System (§9.1)
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["300", "400"],
  display: "swap",
});

// SEO Metadata (§16)
export const metadata: Metadata = {
  title: "William Keffer — Computation × Design × Generative Systems",
  description:
    "Portfolio of William Keffer. Building systems at the intersection of algorithmic precision and human expression. WebGL, generative design, creative coding.",
  openGraph: {
    title: "William Keffer — Portfolio",
    description:
      "Computation × Design × Generative Systems. A WebGL-driven portfolio exploring the aesthetics of complexity.",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "William Keffer — Portfolio",
    description: "Computation × Design × Generative Systems",
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
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
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
