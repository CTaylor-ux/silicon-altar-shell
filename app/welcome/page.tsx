import Link from 'next/link';
import data from '@/lib/landing.generated.json';
import { AUDIENCES, CORRECTIONS, HERO, JOHNSON, MOTTO, STEPS, TRUST } from '@/lib/landing-content';
import styles from './landing.module.css';

/**
 * The public landing page (Thread 37). The one page reachable without a code,
 * besides /enter itself (middleware.ts). Figures and the dossier come from the
 * corpus through scripts/prepare-landing.mjs; words that are not data live in
 * lib/landing-content.ts. It shares the app's type and colour so stepping inside
 * feels like the same building.
 */

const STATUS: Record<string, { label: string; tone: string }> = {
  live_verified: { label: 'Read', tone: styles.read },
  citation_only: { label: 'Cited, not yet opened', tone: styles.cited },
  needs_verification: { label: 'Not yet checked', tone: styles.unchecked },
};
const VERDICT: Record<string, string> = { eliminated: styles.vElim, holding: styles.vHolding, held: styles.vHeld };

export default function Landing() {
  const t = data.totals;
  const pctRead = Math.round((t.sourcesRead / t.sources) * 100);
  const casor = data.casor;
  const weight = casor?.badges.find((b) => b.startsWith('Weight:'))?.replace(/^Weight:\s*/, '').split(' · ') ?? [];

  return (
    <main className={styles.page}>
      {/* 1. Opening */}
      <section className={styles.hero}>
        <video className={styles.heroVideo} src="/landing/hero-loop.mp4" autoPlay muted loop playsInline aria-hidden />
        <div className={styles.heroShade} />
        <div className={styles.heroInner}>
          <p className={`${styles.kicker} mono`}>{HERO.kicker}</p>
          <h1 className={styles.heroTitle}>{HERO.title}</h1>
          <p className={styles.heroLine}>{HERO.line}</p>
          <div className={styles.actions}>
            <a className={styles.primary} href="#film"><span className={styles.play} aria-hidden />Watch the film</a>
            <a className={styles.secondary} href="#invite">Request an invitation</a>
            <Link className={styles.ghost} href="/enter?from=/windows">I have a code</Link>
          </div>
        </div>
      </section>

      {/* 2. The film */}
      <section id="film" className={styles.section}>
        <p className={`${styles.label} mono`}>The film · about four minutes</p>
        <h2 className={styles.h2}>One case, followed all the way through.</h2>
        <video className={styles.film} src="/landing/film.mp4" poster="/landing/film-poster.jpg" controls preload="none" />
      </section>

      {/* 3. Why this exists: the author's own words go here. */}
      <section className={styles.section}>
        <p className={`${styles.label} mono`}>Why this exists</p>
        <div className={styles.placeholder}>
          <p className={styles.placeholderHead}>Your story goes here, in your own voice.</p>
          <ul>
            <li>When did you first notice a gap between what you were taught and what the records say?</li>
            <li>What was the first document that stopped you?</li>
            <li>Why build an archive that shows its doubts, instead of a book that hides them?</li>
            <li>Who did you build it for?</li>
          </ul>
        </div>
      </section>

      {/* 4. The seven windows */}
      <section className={styles.section}>
        <p className={`${styles.label} mono`}>Seven windows</p>
        <h2 className={styles.h2}>Nine hundred years, set side by side.</h2>
        <div className={styles.windows}>
          {data.windows.map((w) => (
            <article key={w.id} className={styles.window}>
              {w.map && (
                // eslint-disable-next-line @next/next/no-img-element
                <img className={styles.windowMap} src={w.map.img} alt={`${w.map.title}, ${w.map.date}`} loading="lazy" />
              )}
              <div className={styles.windowBody}>
                <span className={`${styles.windowN} mono`}>Window {w.n}</span>
                <h3 className={styles.windowName}>{w.name}</h3>
                <span className={`${styles.windowRange} mono`}>{w.range} · {w.entries} entries</span>
                {w.map && <span className={styles.windowCredit}>{w.map.maker ? `${w.map.maker}, ` : ''}{w.map.date} · {w.map.holder}</span>}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* 5. How it works, on a real dossier */}
      <section className={styles.section}>
        <p className={`${styles.label} mono`}>How it works</p>
        <h2 className={styles.h2}>Every claim tells you how sure it is.</h2>
        <div className={styles.howGrid}>
          <ol className={styles.steps}>
            {STEPS.map((s) => (
              <li key={s.n}>
                <span className={`${styles.stepN} mono`}>{s.n}</span>
                <div><h3>{s.title}</h3><p>{s.text}</p></div>
              </li>
            ))}
          </ol>
          {casor && (
            <div className={styles.dossier} aria-label="An example dossier, as it stands in the corpus">
              <div className={`${styles.dossierHead} mono`}>Evidence dossier · 1655</div>
              <div className={styles.dossierBody}>
                <h3 className={styles.dossierTitle}>{casor.title}</h3>
                <div className={styles.badges}>
                  {weight[0] && <span className={`${styles.badge} ${styles.bProven} mono`}>{weight[0]}</span>}
                  {weight[1] && <span className={`${styles.badge} ${styles.bContested} mono`}>{weight[1]}</span>}
                </div>
                <p className={`${styles.dossierLabel} mono`}>Sources</p>
                {casor.sources.map((s, i) => {
                  const st = STATUS[s.status ?? ''] ?? { label: s.status ?? '', tone: styles.cited };
                  return (
                    <div key={i} className={styles.src}>
                      <span className={`${styles.srcTier} mono`}>[{s.tier}]</span>
                      <span className={styles.srcTitle}>{s.title}</span>
                      <span className={`${styles.srcStatus} ${st.tone} mono`}>{st.label}</span>
                    </div>
                  );
                })}
                <p className={`${styles.dossierLabel} mono`}>Explanations weighed</p>
                {casor.hypotheses.map((h, i) => (
                  <div key={i} className={styles.hyp}>
                    <span>{h.label}</span>
                    <span className={`${styles.verdict} ${VERDICT[h.verdict] ?? ''} mono`}>{h.verdict}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 6. The work, in numbers, and the corrections */}
      <section className={styles.section}>
        <p className={`${styles.label} mono`}>The work, kept honest</p>
        <div className={styles.numbers}>
          <div><span className={styles.num}>{t.windows}</span><span className="mono">Windows</span></div>
          <div><span className={styles.num}>{t.entries}</span><span className="mono">Entries</span></div>
          <div><span className={styles.num}>{t.dossiers}</span><span className="mono">Dossiers</span></div>
          <div><span className={styles.num}>{t.sources.toLocaleString('en-US')}</span><span className="mono">Sources</span></div>
          <div><span className={styles.num}>{pctRead}%</span><span className="mono">Opened and read</span></div>
        </div>
        <h2 className={styles.h2}>Corrections we have made.</h2>
        <div className={styles.corrections}>
          {CORRECTIONS.map((c, i) => (
            <div key={i} className={styles.correction}>
              <p className={styles.was}><span className="mono">Was</span>{c.was}</p>
              <p className={styles.now}><span className="mono">Now</span>{c.now}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 7. One story, followed */}
      <section className={styles.section}>
        <p className={`${styles.label} mono`}>One story, followed</p>
        <h2 className={styles.h2}>The word he used was turned on his own family.</h2>
        <div className={styles.story}>
          {JOHNSON.map((s) => (
            <div key={s.year} className={styles.storyItem}>
              <span className={styles.storyYear}>{s.year}</span>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
        <Link className={styles.secondary} href="/enter?from=/windows/2">Follow it inside →</Link>
      </section>

      {/* 8. Who it is for, and the invitation */}
      <section id="invite" className={styles.section}>
        <p className={`${styles.label} mono`}>Who it is for</p>
        <div className={styles.audiences}>
          {AUDIENCES.map((a) => (<div key={a.title}><h3>{a.title}</h3><p>{a.text}</p></div>))}
        </div>
        <div className={styles.invite}>
          <div>
            <h2 className={styles.h2}>Access is by invitation.</h2>
            <p>Each invitation is personal, because what you ask and what you bring is credited to you.</p>
          </div>
          <div className={styles.inviteActions}>
            <span className={styles.todo}>Request route to be connected: an email address or a short form.</span>
            <Link className={styles.ghost} href="/enter?from=/windows">I have a code</Link>
          </div>
        </div>
      </section>

      {/* 9. Trust */}
      <section className={styles.section}>
        <p className={`${styles.label} mono`}>What you can count on</p>
        <div className={styles.trust}>
          {TRUST.map((x) => (<div key={x.title}><h3>{x.title}</h3><p>{x.text}</p></div>))}
        </div>
      </section>

      {/* 10. Footer */}
      <footer className={styles.footer}>
        <p className={styles.motto}>{MOTTO}</p>
        <p className={`${styles.credits} mono`}>
          Period maps from the Library of Congress and the Boston Public Library, shown under their stated terms.
          Film music: “Lost Time” by Kevin MacLeod (incompetech.com), licensed under Creative Commons: By Attribution 4.0.
        </p>
      </footer>
    </main>
  );
}
