import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Archivo, Shippori_Mincho } from "next/font/google";
import "./globals.css";

// Typography System (design roadmap W2)
// Display: Archivo variable — wght + wdth axes power the kinetic type in W5.
// Paid upgrade path: Neue Haas Grotesk Display (swap via --font-display only).
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
});

// Accent: Mincho-style serif for epigraphs / Japanese-editorial moments only.
const shipporiMincho = Shippori_Mincho({
  variable: "--font-shippori",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

// SEO Metadata (§16)
export const metadata: Metadata = {
  metadataBase: new URL("https://williamkeffer.com"),
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
      className={`${archivo.variable} ${shipporiMincho.variable} ${inter.variable} ${jetbrainsMono.variable}`}
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
