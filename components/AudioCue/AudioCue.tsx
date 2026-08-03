'use client';

/**
 * AudioCue — a slim, quiet per-window audio strip.
 *
 * Deliberately not a media player: play/pause, a hairline progress line, and a
 * time readout. No volume, no scrub thumb, no artwork. It sits directly beneath
 * the top rail so it is adjacent to the window's own intro prose when a window
 * opens, without the shell modifying the window document.
 *
 * Source comes from lib/window-content.ts. A missing file renders an explicit
 * unavailable state — a silent dead button would read as a broken product.
 */

import { useEffect, useRef, useState } from 'react';
import type { AudioTrack } from '@/lib/window-content';
import styles from './AudioCue.module.css';

type Props = {
  audio: AudioTrack | null;
  windowId: number;
  /** Distinguishes this control from the guide narration for screen readers. */
  purpose: string;
  /** 'docked' pins it under the top rail; 'inline' flows in normal layout. */
  variant?: 'docked' | 'inline';
};

const fmt = (s: number) => {
  if (!isFinite(s) || s < 0) return '--:--';
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
};

export default function AudioCue({
  audio,
  windowId,
  purpose,
  variant = 'docked',
}: Props) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [dur, setDur] = useState(0);
  const [pos, setPos] = useState(0);
  const [unavailable, setUnavailable] = useState(false);

  // Moving between windows must stop the previous window's narration.
  useEffect(() => {
    setPlaying(false);
    setPos(0);
    setDur(0);
    setUnavailable(false);
    const el = ref.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
  }, [windowId]);

  if (!audio) return null;

  const toggle = () => {
    const el = ref.current;
    if (!el || unavailable) return;
    if (el.paused) {
      el.play().then(
        () => setPlaying(true),
        () => setUnavailable(true)
      );
    } else {
      el.pause();
      setPlaying(false);
    }
  };

  const pct = dur > 0 ? (pos / dur) * 100 : 0;

  return (
    <div className={`${styles.bar} ${variant === 'inline' ? styles.inline : ''}`}>
      <button
        className={styles.play}
        onClick={toggle}
        disabled={unavailable}
        aria-label={`${playing ? 'Pause' : 'Play'} ${purpose}`}
        title={unavailable ? `${purpose} — not yet available` : purpose}
      >
        {playing ? (
          <span className={styles.pauseGlyph} aria-hidden />
        ) : (
          <span className={styles.playGlyph} aria-hidden />
        )}
      </button>

      <span className={`${styles.cue} mono`}>{audio.cue}</span>

      {unavailable ? (
        <span className={`${styles.unavailable} mono`}>Audio not yet available</span>
      ) : (
        <>
          <span className={styles.track} aria-hidden>
            <span className={styles.fill} style={{ width: `${pct}%` }} />
          </span>
          <span className={`${styles.time} mono`}>
            {dur > 0 ? `${fmt(pos)} / ${fmt(dur)}` : audio.durationLabel ?? '--:--'}
          </span>
        </>
      )}

      <audio
        ref={ref}
        src={audio.src}
        preload="metadata"
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
        onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)}
        onEnded={() => {
          setPlaying(false);
          setPos(0);
        }}
        onError={() => setUnavailable(true)}
      />
    </div>
  );
}
