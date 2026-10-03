'use client';

/**
 * The invitation request (Thread 37). Posts to /api/request, which saves it
 * beside the app for the author to read. Four fields, one of them optional,
 * plus a hidden one that only bots fill.
 */

import { useState } from 'react';
import styles from './landing.module.css';

const ROLES = [
  { value: 'heir', label: 'An heir' },
  { value: 'researcher', label: 'A researcher' },
  { value: 'educator', label: 'An educator' },
  { value: 'other', label: 'Something else' },
];

export default function InviteForm() {
  const [role, setRole] = useState('heir');
  const [state, setState] = useState<'idle' | 'working' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');
  const [name, setName] = useState('');

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === 'working') return;
    const f = new FormData(e.currentTarget);
    setState('working');
    setError('');
    try {
      const res = await fetch('/api/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: f.get('name'), email: f.get('email'), role, note: f.get('note'), website: f.get('website'),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'That did not go through. Try again.');
        setState('error');
        return;
      }
      setName(String(f.get('name') ?? '').split(' ')[0]);
      setState('sent');
    } catch {
      setError('Could not reach the server. Try again.');
      setState('error');
    }
  }

  if (state === 'sent') {
    return (
      <div className={styles.sent} role="status">
        <p className={styles.sentHead}>Thank you{name ? `, ${name}` : ''}. Your request is in.</p>
        <p>The author reads each one. If it is a fit, your personal code will come by email.</p>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <fieldset className={styles.roles}>
        <legend>I am</legend>
        {ROLES.map((r) => (
          <label key={r.value} className={role === r.value ? styles.roleOn : undefined}>
            <input type="radio" name="role" value={r.value} checked={role === r.value} onChange={() => setRole(r.value)} />
            {r.label}
          </label>
        ))}
      </fieldset>
      <label className={styles.field}>
        <span>Your name</span>
        <input name="name" required maxLength={120} autoComplete="name" />
      </label>
      <label className={styles.field}>
        <span>Email</span>
        <input name="email" type="email" required maxLength={200} autoComplete="email" />
      </label>
      <label className={styles.field}>
        <span>What brings you here? <em>Optional</em></span>
        <textarea name="note" rows={3} maxLength={1500} placeholder="A family name, a place, a question, a source you hold" />
      </label>
      <label className={styles.trap} aria-hidden>
        Leave this empty <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      {error && <p className={styles.formError} role="alert">{error}</p>}
      <button className={styles.primary} type="submit" disabled={state === 'working'}>
        {state === 'working' ? 'Sending' : 'Request an invitation'}
      </button>
    </form>
  );
}
