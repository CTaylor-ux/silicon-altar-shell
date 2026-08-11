'use client';

/**
 * /enter — redeem an invite.
 *
 * The only page reachable without a session. It asks for a personal invite code
 * rather than a shared password, and the copy says so, because the difference is
 * the point: what a researcher brings is going to be recorded under their name
 * and they are going to be shown what became of it.
 *
 * `from` is read off window.location rather than useSearchParams, which would
 * drag a Suspense boundary in for one string.
 */

import { useEffect, useState } from 'react';
import styles from './enter.module.css';

export default function EnterPage() {
  const [code, setCode] = useState('');
  const [state, setState] = useState<'idle' | 'working' | 'error'>('idle');
  const [error, setError] = useState('');
  const [from, setFrom] = useState('/');

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('from');
    if (p && p.startsWith('/') && !p.startsWith('//')) setFrom(p);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || state === 'working') return;
    setState('working');
    setError('');
    try {
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'That did not work.');
        setState('error');
        return;
      }
      /* Hard navigation, not router.push: the whole point is to re-enter
         through middleware now carrying the cookie. */
      window.location.href = from;
    } catch {
      setError('Could not reach the server.');
      setState('error');
    }
  }

  return (
    <main className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>The Silicon Altar</h1>
        <p className={styles.sub}>A forensic audit of the American Levant, in seven windows.</p>

        <form onSubmit={submit}>
          <label className={styles.label} htmlFor="code">
            Your invite code
          </label>
          <input
            id="code"
            className={styles.input}
            type="password"
            autoComplete="one-time-code"
            spellCheck={false}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="paste the code from your invitation"
            disabled={state === 'working'}
          />
          <button className={styles.button} type="submit" disabled={state === 'working' || !code.trim()}>
            {state === 'working' ? 'Checking…' : 'Enter'}
          </button>
        </form>

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        <p className={styles.note}>
          This code is yours alone, not a shared password. Questions you ask and sources you
          bring are recorded under your name so that you can be shown what became of them.
        </p>
      </div>
    </main>
  );
}
