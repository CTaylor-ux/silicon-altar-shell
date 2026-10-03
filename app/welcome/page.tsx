import Link from 'next/link';
import data from '@/lib/landing.generated.json';
import {
  AFTER_REQUEST, AUDIENCES, CORRECTIONS, HERO, HOW, JOHNSON, MOTTO, OPENING_RECORD, TRUST,
} from '@/lib/landing-content';
import InviteForm from './InviteForm';
import styles from './landing.module.css';

/**
 * The public landing page (Thread 37), at /welcome. The one page reachable
 * without a code, besides /enter (middleware.ts). Figures and the dossier come
 * from the corpus through scripts/prepare-landing.mjs; words that are not data
 * live in lib/landing-content.ts.
 *
 * Three kinds of type, one for each layer of the archive: the record's own
 * words in Caslon, the archive's reading in Space Grotesk, and the evidence
 * markers in Plex Mono. One action, asked three times: request an invitation.
 */

const STATUS: Record<string, { label: string; tone: string }> = {
  live_verified: { label: 'Read', tone: styles.read },
  citation_only: { label: 'Cited, not yet opened', tone: styles.cited },
  needs_verification: { label: 'Not yet checked', tone: styles.unchecked },
};
const VERDICT: Record<string, string> = { eliminated: styles.vElim, holding: styles.vHolding, held: styles.vHeld };

export default function Landing() {
  const t = data.totals;
  const casor = data.casor;
  const weight = casor?.badges.find((b) => b.startsWith('Weight:'))?.replace(/^Weight:\s*/, '').split(' · ') ?? [];
  const orderBook = casor?.sources.find((s) => /Order Book/i.test(s.title));
  const routine = casor?.hypotheses.find((h) => h.verdict === 'eliminated');

  return (
    <div className={styles.page}>
      <header className={styles.bar}>
        <Link href="/welcome" className={styles.mark}>The Silicon Altar</Link>
        <nav className={styles.barNav}>
          <a href="#how">How it works</a>
          <a href="#story">The film</a>
          <Link href="/enter?from=/">I have a code</Link>
          <a className={styles.barCta} href="#invite">Request an invitation</a>
        </nav>
      </header>

      <main>
        {/* 1. The opening: a promise in plain words, and one record as the proof. */}
        <section className={styles.hero}>
          <div className={styles.heroText}>
            <h1 className={styles.heroTitle}>{HERO.title}</h1>
            <p className={styles.heroLine}>{HERO.line}</p>
            <div className={styles.actions}>
              <a className={styles.primary} href="#invite">Request an invitation</a>
              <a className={styles.textLink} href="#story">Watch the four-minute film</a>
            </div>
            <p className={styles.proof}>
              {t.entries} records in {t.windows} windows. {t.sources.toLocaleString('en-US')} sources,{' '}
              {t.sourcesRead.toLocaleString('en-US')} of them opened and read. Every gap is marked.
            </p>
          </div>

          <figure className={styles.record} aria-label="One record from the archive, with its evidence">
            <div className={styles.paper}>
              <blockquote className={styles.recordQuote}>&ldquo;{OPENING_RECORD.quote}&rdquo;</blockquote>
              <figcaption className={styles.recordWho}>{OPENING_RECORD.who}</figcaption>
            </div>
            <ul className={styles.tags}>
              {orderBook && (
                <li style={{ animationDelay: '500ms' }}>
                  <span className={styles.tagKey}>The county&rsquo;s order book</span>
                  <span className={`${styles.srcStatus} ${(STATUS[orderBook.status ?? ''] ?? STATUS.citation_only).tone}`}>
                    {orderBook.status === 'live_verified' ? 'Read, in transcription' : (STATUS[orderBook.status ?? ''] ?? STATUS.citation_only).label}
                  </span>
                </li>
              )}
              {routine && (
                <li style={{ animationDelay: '900ms' }}>
                  <span className={styles.tagKey}>&ldquo;Just a dispute between neighbours&rdquo;</span>
                  <span className={`${styles.verdict} ${styles.vElim}`}>Eliminated</span>
                </li>
              )}
              {weight[0] && (
                <li style={{ animationDelay: '1300ms' }}>
                  <span className={styles.tagKey}>What the court decided</span>
                  <span className={`${styles.verdict} ${styles.vHeld}`}>Proven</span>
                </li>
              )}
            </ul>
            <p className={styles.recordNote}>{OPENING_RECORD.note}</p>
          </figure>
        </section>

        {/* 2. How sure is it: the whole dossier, live, with the reasons behind each verdict. */}
        {casor && (
          <section id="how" className={styles.section}>
            <div className={styles.howGrid}>
              <div>
                <h2 className={styles.h2}>Open any claim, and it tells you how sure it is.</h2>
                <ol className={styles.how}>
                  {HOW.map((h) => (<li key={h.title}><h3>{h.title}</h3><p>{h.text}</p></li>))}
                </ol>
              </div>

              <article className={styles.dossier} aria-label="The dossier for this case, as it stands in the archive">
                <p className={styles.dossierKind}>Evidence dossier, 1655</p>
                <h3 className={styles.dossierTitle}>{casor.title}</h3>
                <div className={styles.badges}>
                  {weight[0] && <span className={`${styles.badge} ${styles.bProven}`}>{weight[0]}</span>}
                  {weight[1] && <span className={`${styles.badge} ${styles.bContested}`}>{weight[1]}</span>}
                </div>

                <h4 className={styles.dossierLabel}>Sources</h4>
                <ul className={styles.srcList}>
                  {casor.sources.map((s, i) => {
                    const st = STATUS[s.status ?? ''] ?? { label: s.status ?? '', tone: styles.cited };
                    return (
                      <li key={i} className={styles.src}>
                        <span className={styles.srcTier} title={`Tier ${s.tier}`}>{s.tier}</span>
                        <span className={styles.srcTitle}>{s.title}</span>
                        <span className={`${styles.srcStatus} ${st.tone}`}>{st.label}</span>
                      </li>
                    );
                  })}
                </ul>

                <h4 className={styles.dossierLabel}>Explanations weighed. Open one for the reason.</h4>
                {casor.hypotheses.map((h, i) => (
                  <details key={i} className={styles.hyp}>
                    <summary>
                      <span>{h.label.replace(/^H\d,\s*/, '')}</span>
                      <span className={`${styles.verdict} ${VERDICT[h.verdict] ?? ''}`}>{h.verdict}</span>
                    </summary>
                    <p>{h.why}</p>
                  </details>
                ))}
              </article>
            </div>
          </section>
        )}

        {/* 3. One story, followed; and the film that follows it. */}
        <section id="story" className={`${styles.section} ${styles.storySection}`}>
          <h2 className={styles.h2}>The word he used was turned on his own family.</h2>
          <ol className={styles.story}>
            {JOHNSON.map((s) => (
              <li key={s.year}>
                <span className={styles.storyYear}>{s.year}</span>
                <p>
                  {s.text}
                  {'quote' in s && s.quote && <> <q className={styles.inlineRecord}>{s.quote}</q>.</>}
                </p>
              </li>
            ))}
          </ol>

          <div className={styles.film}>
            <video
              className={styles.filmVideo}
              src="/landing/film.mp4"
              poster="/landing/film-poster.jpg"
              controls
              preload="none"
              playsInline
              width={1920}
              height={1080}
              aria-label="The Silicon Altar, a four-minute film following this case. Captions are shown on screen."
            />
            <p className={styles.filmCaption}>
              The film follows this one case for four minutes: what the court wrote, how sure the archive is of it, and what
              happened to the family next. Captions are on screen.
            </p>
          </div>
        </section>

        {/* 4. The seven windows, as the sequence they are. */}
        <section className={styles.section}>
          <h2 className={styles.h2}>Seven windows, from the deep past to today.</h2>
          <p className={styles.lede}>
            Each window sets the records of its period side by side, lane by lane: the law, the land, the money and the
            people. Each opens on a map of its time.
          </p>
          <ol className={styles.windows}>
            {data.windows.map((w) => (
              <li key={w.id} className={styles.window}>
                {w.map && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className={styles.windowMap} src={w.map.img} alt={`${w.map.title}, ${w.map.date}`} loading="lazy" />
                )}
                <span className={styles.windowN}>{w.n}</span>
                <h3 className={styles.windowName}>{w.name}</h3>
                <p className={styles.windowRange}>{w.range}</p>
                <p className={styles.windowCount}>{w.entries} records</p>
              </li>
            ))}
          </ol>
        </section>

        {/* 5. The archive corrects itself, in public. */}
        <section className={styles.section}>
          <h2 className={styles.h2}>When the archive is wrong, it says so.</h2>
          <p className={styles.lede}>Three corrections, made after someone went back to the document itself.</p>
          <div className={styles.corrections}>
            {CORRECTIONS.map((c, i) => (
              <div key={i} className={styles.correction}>
                <p className={styles.was}><s>{c.was}</s></p>
                <p className={styles.now}>{c.now}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 6. Who it is for, and the author's own voice (to be written). */}
        <section className={styles.section}>
          <h2 className={styles.h2}>Built first for the heirs.</h2>
          <div className={styles.audiences}>
            {AUDIENCES.map((a) => (<div key={a.title}><h3>{a.title}</h3><p>{a.text}</p></div>))}
          </div>
          <aside className={styles.placeholder}>
            <p className={styles.placeholderHead}>A note from the author, in the author&rsquo;s own words. To be written.</p>
            <p>Why this archive exists, the first document that stopped you, and who you built it for. A few sentences in your own voice will do more here than anything else on the page.</p>
          </aside>
        </section>

        {/* 7. The invitation. */}
        <section id="invite" className={`${styles.section} ${styles.inviteSection}`}>
          <div className={styles.inviteGrid}>
            <div>
              <h2 className={styles.h2}>Ask for an invitation.</h2>
              <p className={styles.lede}>Each invitation is personal, because what you ask and what you bring is credited to you.</p>
              <ol className={styles.after}>
                {AFTER_REQUEST.map((x) => <li key={x}>{x}</li>)}
              </ol>
              <div className={styles.trust}>
                {TRUST.map((x) => (<div key={x.title}><h3>{x.title}</h3><p>{x.text}</p></div>))}
              </div>
            </div>
            <InviteForm />
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <p className={styles.motto}>{MOTTO}</p>
        <p className={styles.credits}>
          Period maps from the Library of Congress and the Boston Public Library, shown under their stated terms.
          Film music: &ldquo;Lost Time&rdquo; by Kevin MacLeod (incompetech.com), licensed under Creative Commons: By
          Attribution 4.0. <Link href="/enter?from=/">I have a code</Link>
        </p>
      </footer>
    </div>
  );
}
