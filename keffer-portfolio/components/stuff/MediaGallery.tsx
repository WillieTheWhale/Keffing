import Image from "next/image";
import { mediaMusic, mediaGames } from "@/content/media";
import styles from "./MediaGallery.module.css";

/**
 * The media catalogue: a shelf of record sleeves (cover art at full colour —
 * the one place on the site photographs are not screen-printed), then the
 * games as plain ledger rows. Film gets its own shelf when the stills land.
 */
export default function MediaGallery() {
  return (
    <section aria-label="Media collection" className={styles.collection}>
      <div className={`content-panel ${styles.shelf}`}>
      <div className={styles.instructions}>
        <span>Music / {mediaMusic.length} records</span>
        <span>Heavy rotation</span>
      </div>
      <div className={styles.grid}>
        {mediaMusic.map((m, i) => {
          const cover = (
            <Image src={`/assets/media/${m.id}.jpg`} alt={`${m.title} — ${m.by}, cover art`} width={800} height={800} unoptimized loading={i < 4 ? "eager" : "lazy"} />
          );
          return (
            <article key={m.id} className={styles.card}>
              <div className={styles.fileLabel}>
                <span>MD / {String(i + 1).padStart(2, "0")}</span>
                <span><em>{m.kind}</em>{m.year ? ` · ${m.year}` : ""}</span>
              </div>
              {m.url ? (
                <a href={m.url} target="_blank" rel="noopener noreferrer" className={styles.sleeve} aria-label={`${m.title} by ${m.by} — opens in a new tab`}>{cover}</a>
              ) : (
                <div className={styles.sleeve}>{cover}</div>
              )}
              <div className={styles.details}>
                <h2 lang={/[぀-ヿ一-鿿]/.test(m.title) ? "ja" : undefined}>
                  {m.title}
                  {m.alt && <small lang="en">{m.alt}</small>}
                </h2>
                <p className={styles.by}>{m.by}</p>
                {m.note && <p className={styles.note}>{m.note}</p>}
              </div>
            </article>
          );
        })}
      </div>
      </div>

      <div className={`content-panel ${styles.games}`}>
        <div className={styles.instructions}>
          <span>Games / in rotation</span>
          <span>{mediaGames.length} titles</span>
        </div>
        {mediaGames.map((g, i) => (
          <div key={g.id} className={styles.gameRow}>
            <span>{String(i + 1).padStart(2, "0")}</span>
            <span><strong>{g.title}</strong></span>
            <span>{g.note}</span>
            <span>{g.kind}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
