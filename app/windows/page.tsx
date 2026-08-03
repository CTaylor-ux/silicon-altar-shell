'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { WINDOWS } from '@/lib/windows';
import { useSession } from '@/lib/session';
import styles from './selector.module.css';

/**
 * Window selector — the seven as clickable options, chronological, left to
 * right. Sits on a hairline spine so the run reads as one timeline you are
 * about to enter at a chosen point, not seven separate documents.
 */
export default function SelectorPage() {
  const router = useRouter();
  const { state } = useSession();

  // Prefetch the window route so the first click is as instant as prev/next.
  useEffect(() => {
    router.prefetch(`/windows/${state.currentWindow}`);
  }, [router, state.currentWindow]);

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <Link className={`${styles.back} mono`} href="/">
          ← Intro
        </Link>
        <h1 className={styles.title}>Seven Windows</h1>
        <p className={`${styles.hint} mono`}>
          Enter anywhere · travel left and right from there
        </p>
      </header>

      <div className={styles.run}>
        {WINDOWS.map((w) => (
          <Link key={w.id} className={styles.card} href={`/windows/${w.id}`}>
            <span className={`${styles.index} mono`}>Window {w.id}</span>
            <span className={styles.name}>{w.name}</span>
            <span className={`${styles.range} mono`}>{w.yearRange}</span>
            <span className={styles.spacer} />
            <span className={styles.counts}>
              <span className={`${styles.count} mono`}>{w.entries} entries</span>
              <span className={`${styles.count} mono`}>{w.dossiers} dossiers</span>
            </span>
          </Link>
        ))}
      </div>

      <footer className={styles.foot}>
        <span className="mono">
          {state.history.length > 0
            ? `${state.history.length} question${state.history.length === 1 ? '' : 's'} this session`
            : 'Mockup, retrieval is stubbed'}
        </span>
      </footer>
    </main>
  );
}
