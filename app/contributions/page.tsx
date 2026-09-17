'use client';

/**
 * /contributions — what I asked, and what became of it.
 *
 * The credit mechanism made visible. Nobody keeps bringing sources to a queue
 * they cannot see, and this beta is hand-picked people who will bring them.
 *
 * The last-seen mark lives in localStorage rather than on the server: the
 * "since you were last here" list is a timestamp filter over a timeline that
 * already exists, so a per-person server cursor would be new state for
 * something a string already answers. Per-browser is the right grain for a beta.
 */

import { useCallback, useEffect, useState } from 'react';
import styles from './contributions.module.css';

type ReaderStatus = 'received' | 'in-review' | 'installed' | 'declined' | 'deferred';

type Contribution = {
  id: string;
  askedAt: string;
  question: string;
  answer: string;
  citedEntryIds: string[];
  targetEntry: string | null;
  broughtUrl: string | null;
  broughtPassage: string | null;
  status: ReaderStatus;
  reason: string | null;
  decidedAt: string | null;
};

type Payload = {
  person: { id: string; name: string; role: string };
  contributions: Contribution[];
  changed: Contribution[];
  today: { asked: number; limit: number; remaining: number | null };
};

const LAST_SEEN = 'sa.contributions.lastSeen';

const LABEL: Record<ReaderStatus, string> = {
  received: 'Received',
  'in-review': 'In review',
  installed: 'Installed',
  declined: 'Declined',
  deferred: 'Held',
};

/** Plain-language, because the status word alone tells a contributor nothing
 *  about what actually happened to their work. */
const MEANS: Record<ReaderStatus, string> = {
  received: 'Logged. Not yet looked at.',
  'in-review': 'Being worked through.',
  installed: 'In the corpus now.',
  declined: 'Not going in. The reason is below.',
  deferred: 'Real, but parked for now.',
};

function when(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function ContributionsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState('');
  const [since, setSince] = useState<string | null>(null);

  useEffect(() => {
    setSince(window.localStorage.getItem(LAST_SEEN));
  }, []);

  const load = useCallback(async (sinceMark: string | null) => {
    try {
      const qs = sinceMark ? `?since=${encodeURIComponent(sinceMark)}` : '';
      const res = await fetch(`/api/contributions${qs}`);
      if (res.status === 401) {
        window.location.href = '/enter?from=/contributions';
        return;
      }
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? 'Could not load your contributions.');
        return;
      }
      setData(body);
      /* Stamped only after a successful render, so a failed load never
         silently marks everything as seen. */
      window.localStorage.setItem(LAST_SEEN, new Date().toISOString());
    } catch {
      setError('Could not reach the server.');
    }
  }, []);

  useEffect(() => {
    void load(since);
    // `since` is read once on mount; re-running on its change would clear the
    // banner the moment it rendered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  if (error) return <main className={styles.wrap}><p className={styles.error}>{error}</p></main>;
  if (!data) return <main className={styles.wrap}><p className={styles.muted}>Loading…</p></main>;

  const { contributions, changed, today, person } = data;

  return (
    <main className={styles.wrap}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>What you have brought</h1>
          <p className={styles.sub}>
            {person.name}
            {today.remaining !== null ? (
              <>
                {' · '}
                {today.remaining} of {today.limit} questions left today
              </>
            ) : null}
          </p>
        </div>
        <a className={styles.back} href="/">
          Back to the windows
        </a>
      </header>

      {changed.length > 0 ? (
        <section className={styles.changed}>
          <h2 className={styles.changedTitle}>Since you were last here</h2>
          <ul className={styles.changedList}>
            {changed.map((c) => (
              <li key={c.id}>
                <strong>{LABEL[c.status]}</strong>
                {' — '}
                {c.question.length > 110 ? `${c.question.slice(0, 110)}…` : c.question}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {contributions.length === 0 ? (
        <p className={styles.muted}>
          Nothing yet. Ask a question from any window, and if you have a source, paste the link
          and the passage straight into what you ask. It will show up here.
        </p>
      ) : null}

      <ol className={styles.list}>
        {contributions.map((c) => (
          <li key={c.id} className={`${styles.item} ${styles[`s_${c.status.replace('-', '')}`]}`}>
            <div className={styles.itemHead}>
              <span className={styles.status}>{LABEL[c.status]}</span>
              <span className={styles.date}>{when(c.askedAt)}</span>
            </div>

            <p className={styles.question}>{c.question}</p>
            <p className={styles.means}>{MEANS[c.status]}</p>

            {c.status === 'declined' && c.reason ? (
              <blockquote className={styles.reason}>{c.reason}</blockquote>
            ) : null}
            {c.status !== 'declined' && c.reason ? (
              <p className={styles.note}>{c.reason}</p>
            ) : null}

            {c.broughtUrl || c.broughtPassage ? (
              <div className={styles.brought}>
                <span className={styles.broughtLabel}>You brought</span>
                {c.broughtUrl ? <p className={styles.broughtUrl}>{c.broughtUrl}</p> : null}
                {c.broughtPassage ? (
                  <blockquote className={styles.passage}>{c.broughtPassage}</blockquote>
                ) : null}
              </div>
            ) : null}

            {c.targetEntry ? (
              <p className={styles.bears}>
                Bears on <code className={styles.code}>{c.targetEntry}</code>
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </main>
  );
}
