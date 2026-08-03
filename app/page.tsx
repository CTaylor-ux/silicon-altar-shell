import Link from 'next/link';
import { WINDOWS, WINDOW_COUNT, LANES } from '@/lib/windows';
import CountUp from '@/components/CountUp';
import styles from './page.module.css';

/**
 * Intro — the entry point. The door, not the house.
 *
 * Figures are read from the corpus (windows.json via the prepare step) rather
 * than typed, so this page cannot drift from the data the way the May 2026
 * companion guides did.
 */
export default function IntroPage() {
  const totalEntries = WINDOWS.reduce((n, w) => n + w.entries, 0);
  const totalDossiers = WINDOWS.reduce((n, w) => n + w.dossiers, 0);

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <p className={`${styles.eyebrow} mono`}>
          A forensic audit of the Siphon of the American Levant
        </p>

        <h1 className={styles.title}>The Silicon Altar</h1>
        <p className={styles.subtitle}>Seven windows, deep time to 2029.</p>

        <div className={styles.rule} />

        <p className={styles.lead}>
          History gets told one thread at a time: the law over here, the money over there, the
          people somewhere else. Line the threads up and something surfaces through the seams,
          one operation, running for hundreds of years, that most accounts never name because
          they never set the columns side by side.
        </p>
        <p className={styles.leadDim}>
          This audit sets them side by side. Every claim carries its standing. Every row can be
          checked. The people written out of the record were never the minority in it. Start
          anywhere in the sequence and follow the seam.
        </p>

        <div className={styles.rule} />

        {/* Figures still come from the corpus; CountUp only animates the
            reveal. Staggered so the row ticks up as a group, not in lockstep. */}
        <div className={styles.figures}>
          <div className={styles.figure}>
            <span className={styles.figureNum}>
              <CountUp value={WINDOW_COUNT} delay={0} />
            </span>
            <span className={`${styles.figureLabel} mono`}>Windows</span>
          </div>
          <div className={styles.figure}>
            <span className={styles.figureNum}>
              <CountUp value={totalEntries} delay={90} />
            </span>
            <span className={`${styles.figureLabel} mono`}>Entries</span>
          </div>
          <div className={styles.figure}>
            <span className={styles.figureNum}>
              <CountUp value={totalDossiers} delay={180} />
            </span>
            <span className={`${styles.figureLabel} mono`}>Dossiers</span>
          </div>
          <div className={styles.figure}>
            <span className={styles.figureNum}>
              <CountUp value={LANES.length} delay={270} />
            </span>
            <span className={`${styles.figureLabel} mono`}>Lanes</span>
          </div>
        </div>

        <Link className={styles.enter} href="/windows">
          <span className="mono">Enter the sequence</span>
          <span className={styles.enterArrow} aria-hidden>
            →
          </span>
        </Link>
      </div>

      <footer className={styles.foot}>
        <span className="mono">Mockup, retrieval is stubbed</span>
        {/* FUTURE: member / researcher / author tiers (PRD §4) gate from here. */}
        <span className="mono">No account required</span>
      </footer>
    </main>
  );
}
