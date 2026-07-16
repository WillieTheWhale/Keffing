import Link from "next/link";

/**
 * Lost signal — 404 in the transmission language (roadmap W12).
 * Static and dependency-free: no canvas layers, just the voice.
 */
export default function NotFound() {
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-center"
      style={{ backgroundColor: "#020204" }}
    >
      <span
        className="font-mono uppercase"
        style={{ fontSize: "11px", letterSpacing: "0.35em", color: "#FF3300" }}
      >
        Signal lost
      </span>
      <h1
        className="uppercase"
        style={{
          fontFamily: "var(--font-display), var(--font-sans), sans-serif",
          fontWeight: 800,
          fontStretch: "122%",
          fontSize: "clamp(64px, 14vw, 200px)",
          lineHeight: 0.95,
          letterSpacing: "-0.02em",
          color: "#FFFFFF",
          margin: 0,
        }}
      >
        404
      </h1>
      <p
        className="font-mono"
        style={{
          fontSize: "12px",
          letterSpacing: "0.15em",
          color: "rgba(255,255,255,0.55)",
          maxWidth: "420px",
          lineHeight: 2,
        }}
      >
        this frequency carries no transmission.
        <br />
        re-tune to the main channel.
      </p>
      <Link
        href="/"
        className="font-mono uppercase mt-4"
        style={{
          fontSize: "11px",
          letterSpacing: "0.25em",
          color: "#0099FF",
          border: "1px solid rgba(0,153,255,0.5)",
          padding: "14px 24px",
          textDecoration: "none",
        }}
      >
        Re-acquire signal &rarr;
      </Link>
    </main>
  );
}
