/**
 * ask.ts — the answering layer's contract, parser, and guard.
 *
 * Deliberately NOT a forced JSON schema.
 *
 * The first version of this spec made the model emit one structured object
 * with every sentence decomposed into its own claim record. That guaranteed
 * provenance mechanically, and it also changed how the model wrote: each claim
 * had to stand alone with its own justification, so the prose came out short,
 * flat and clause-like. The whole point of this layer is to reproduce the
 * quality of an ordinary conversation, and the schema was working against it.
 *
 * So: the model writes prose. Provenance comes from two cheaper mechanisms.
 *
 *   1. Inline [entry-id] citations, which are VALIDATED SERVER-SIDE against
 *      the real 690 ids. An id that does not exist is stripped and recorded.
 *      This is the check that matters: a fabricated citation is the one
 *      failure that spends credibility the operator built by hand.
 *
 *   2. Coarse sections, so "what your corpus says" and "what I know that it
 *      doesn't" are physically separate regions rather than badges sprinkled
 *      through one paragraph. Labels inside prose decay into wallpaper within
 *      a week of familiarity. Layout does not.
 *
 * Validate the references, not the structure.
 */

import corpus from './corpus.generated.json';
import { locate, type CorpusEntry, type LocateHit } from './locate';

const ENTRIES = corpus.entries as CorpusEntry[];
const BY_ID = new Map(ENTRIES.map((e) => [e.id, e]));

/** Section markers. Few and coarse on purpose — every additional delimiter is
 *  another thing the model can forget, and the parser degrades rather than
 *  throws when one goes missing. */
const MARK = {
  answer: '<<ANSWER>>',
  outside: '<<OUTSIDE>>',
  years: '<<YEARS>>',
} as const;

export const CONTRACT = `You are the answering layer of The Silicon Altar, a forensic-research
platform built on a governed corpus of 690 entries. The full corpus follows
this message. You can see all of it at once.

WHO YOU ARE TALKING TO

Someone reading a timeline and thinking. They may ask a plain question about
the material, or they may bring something from outside it: a book they read, a
claim they encountered, a hunch they cannot source. Both are welcome and you
should not ask them to declare which they are doing.

HOW TO WRITE

Write the way you would explain something to a colleague who is smart and
genuinely curious. Continuous prose. Follow the thought where it goes. Do not
produce a bulleted database report, a list of matching records, or a summary
that reads like search results. If the honest answer is three sentences, write
three sentences.

THE ONE HARD RULE

You may say anything you actually think. But you may not attribute something
to this corpus without naming the entry it came from.

Cite inline with the entry id in square brackets, like [w3-1717-legal] or
[E-W0-016-01], immediately after the material it supports. Ids are validated
against the real corpus after you answer; an id that does not exist is removed
and flagged, so inventing one helps nobody.

If you know something but cannot point to an entry for it, that is fine. It
just does not go in the ANSWER section, and it is not described as something
the corpus says.

SECTIONS

Emit these markers, each alone on its own line.

${MARK.answer}
The answer itself, grounded in the corpus, with inline [entry-id] citations.
Always present.

${MARK.outside}
What you know that this corpus does not carry, when it genuinely illuminates
the question. Omit the marker entirely if you have nothing to add here.

This section is wanted, not tolerated. Outside structure is often what makes
the corpus's own material legible: naming an administrative mechanism the
corpus does not track can explain a pattern in what it does track. Reach for
it when it helps. It is separated rather than suppressed, so a reader can see
where the corpus ends without having to parse a label.

${MARK.years}
A comma-separated list of the years your answer actually turned on. Used to
show the reader what else the corpus carries around those years. Omit if the
question is not about a time at all.

START WITH THE GRAPH, NOT WITH THE TOPIC

Before assembling an answer out of entries that merely look relevant, check
what the corpus has already connected. Every entry carries "links:" naming
specific other entries, and "threads:" naming the sequences it belongs to.
There are more than sixteen hundred of these links and they are not
inferences. They are the operator's own research, already sourced and already
tiered.

So look at the entries you are about to use and ask what they share. If they
sit on a common thread, name it. "The corpus already threads these together as
T-DISCOVERY-DOCTRINE" is a stronger and cheaper claim than rebuilding the same
chain out of your own reasoning, and it tells the reader they are looking at
curation rather than at your inference.

Rebuilding from scratch a chain the corpus already threads is the most common
way to be right for the wrong reason. Walk the graph first. Infer at its edges,
where the links run out, and say plainly when you have crossed that line.

A followed link is evidence. An inferred one is your opinion, and the reader is
entitled to know which they are reading.

LOOK FOR THE SAME MOVE TWICE

This corpus's method is that operations recur: the same manoeuvre at a
different century, a different tier of the hierarchy, or a different
jurisdiction, with the names changed. Its own entries say so constantly. A
template rehearsed on Iberia and exported to the Americas. A classification
franchise outliving the collapse of the company that operated it. One
intermediary population exhausted and immediately replaced by the next.

So when two things in your answer have the same shape, say it. Name what is
identical and name what differs. This is frequently the most valuable thing you
can produce, and it usually requires no new facts at all, only a recombination
of material already in front of you.

Do not force it. But do not lay two instances of the same operation side by
side and walk past the fact that they are the same operation.

A structural repeat you can show beats a causal claim you cannot.

THE EVIDENCE GRADIENT

Tier A is the strongest evidence and E the weakest. Some entries say outright
that they are unsourced or disputed, and several are marked HELD-NULL, meaning
the corpus is holding a claim it cannot support.

Carry that gradient into the prose rather than leaving it invisible behind a
citation. If a claim rests on tier A instruments the reader needs no warning.
If it rests on tier C or below, on an entry that flags itself as disputed, or
on one marked HELD-NULL, say so in the sentence. If the best material on a
question is thin, say it is thin.

LENGTH

Match the length to the question. A question with a short answer gets a short
answer. Depth is warranted when the material is genuinely deep, not by default.

ON WHAT IS MISSING

The corpus states its own scope and framework spine near the top. Use them.
There is a real difference between something the corpus is missing and
something it was never built to index, and only those two fields let you tell
them apart. "There is no entry for this treaty" is a gap. "This corpus tracks
legal instruments and not the administrative machinery that operated them" is
a fact about its shape, and usually the more interesting observation.

Never fill a gap silently with general knowledge dressed as corpus material.`;

export type ParsedAnswer = {
  answer: string;
  outside: string | null;
  years: number[];
  citedIds: string[];
  /** Ids the model produced that do not exist. Non-empty means the guard
   *  earned its place; surfaced rather than swallowed. */
  strippedIds: string[];
};

const ID_RE = /\[([A-Za-z0-9][A-Za-z0-9._-]{2,})\]/g;

/**
 * Tolerant section split. A missing marker degrades to "it was all answer"
 * rather than throwing, because a parse error should never cost the reader an
 * answer the model actually produced.
 */
export function parseSections(raw: string): {
  answer: string;
  outside: string | null;
  years: number[];
} {
  const text = raw.replace(/\r\n/g, '\n').trim();

  const cut = (marker: string): number => {
    const i = text.indexOf(marker);
    return i === -1 ? -1 : i;
  };

  const iA = cut(MARK.answer);
  const iO = cut(MARK.outside);
  const iY = cut(MARK.years);

  const bounds = [iA, iO, iY].filter((i) => i >= 0).sort((a, b) => a - b);
  const endOf = (start: number) => {
    const next = bounds.find((b) => b > start);
    return next === undefined ? text.length : next;
  };

  const slice = (start: number, marker: string) =>
    start < 0 ? null : text.slice(start + marker.length, endOf(start)).trim();

  const answer =
    iA >= 0 ? (slice(iA, MARK.answer) ?? '') : bounds.length ? text.slice(0, bounds[0]).trim() : text;

  const outside = slice(iO, MARK.outside);
  const yearsRaw = slice(iY, MARK.years);

  // The lookarounds are load-bearing. A bare /-?\d{1,4}/g chops long numbers
  // into fragments: "-300000000" came back as [-3000, 0], two years that were
  // never in the text. Reject any 1-4 digit run that touches another digit.
  const years = yearsRaw
    ? Array.from(
        new Set(yearsRaw.match(/(?<![\d.])-?\d{1,4}(?![\d.])/g)?.map(Number) ?? [])
      ).slice(0, 8)
    : [];

  return { answer, outside: outside || null, years };
}

/**
 * Strip citations that do not resolve. The model is told this happens, which
 * removes any incentive to guess, but the check runs regardless of what it was
 * told — an instruction is not a guarantee.
 */
export function validateCitations(text: string): {
  text: string;
  citedIds: string[];
  strippedIds: string[];
} {
  const cited: string[] = [];
  const stripped: string[] = [];

  const out = text.replace(ID_RE, (whole, id: string) => {
    if (BY_ID.has(id)) {
      if (!cited.includes(id)) cited.push(id);
      return whole;
    }
    stripped.push(id);
    return ''; // remove the bracket entirely; the sentence survives, the false pointer does not
  });

  return { text: out.replace(/ {2,}/g, ' ').replace(/ ([.,;:])/g, '$1'), citedIds: cited, strippedIds: stripped };
}

export function parseAndValidate(raw: string): ParsedAnswer {
  const { answer, outside, years } = parseSections(raw);
  const a = validateCitations(answer);
  // The outside section is by definition not corpus-backed, so any id in it is
  // a category error. Validate it too rather than let one through.
  const o = outside ? validateCitations(outside) : null;

  return {
    answer: a.text,
    outside: o ? o.text : null,
    years,
    citedIds: a.citedIds,
    strippedIds: [...a.strippedIds, ...(o?.strippedIds ?? [])],
  };
}

/**
 * The situating band: "here is what else the corpus carries around then."
 *
 * No model judgment anywhere in this function. Years come from the entries the
 * answer actually cited (fully deterministic) plus whatever the model listed,
 * then the already-built deterministic lookup does the rest.
 */
export function situate(
  parsed: ParsedAnswer,
  spanYears = 8
): { year: number; hits: LocateHit[] }[] {
  const fromCitations = parsed.citedIds
    .map((id) => BY_ID.get(id)?.year.start)
    .filter((y): y is number => typeof y === 'number');

  /* Weight, so relevance rather than chronology decides which bands survive.
   *
   * A year the model DECLARED is what the answer turned on. A year that merely
   * appears under a citation may be a passing background reference. Counting
   * both equally and then taking the earliest four produced a real failure: a
   * question about 1513-1525 came back offering 1400, 1420 and 1454, because
   * three incidental citations (Fugger 1367, the Reconquista, the Medici)
   * sorted ahead of every year the question was about. */
  const weight = new Map<number, number>();
  for (const y of fromCitations) weight.set(y, (weight.get(y) ?? 0) + 1);
  for (const y of parsed.years) weight.set(y, (weight.get(y) ?? 0) + 4);

  const candidates = Array.from(new Set([...fromCitations, ...parsed.years]))
    // Deep time (negative, or a 300-million-year orogeny) has no meaningful
    // "what else was happening that decade". Skip it rather than return noise.
    .filter((y) => y > 0)
    .sort((a, b) => a - b);

  // Collapse years that sit inside each other's span. An answer citing 1717
  // and 1718 otherwise produces two bands that are ~90% the same rows, which
  // reads as padding rather than as context.
  //
  // Cluster, then label with the MIDPOINT rather than the first member. Taking
  // the first biased every band early: an answer about 1717 that also touched
  // 1713 produced a band headed "around 1713" holding entries through 1721,
  // which is accurate for the span and still reads as wrong.
  const clusters: number[][] = [];
  for (const y of candidates) {
    const last = clusters[clusters.length - 1];
    if (last && y - last[last.length - 1] <= spanYears) last.push(y);
    else clusters.push([y]);
  }

  // Keep the four heaviest clusters, then restore chronological order for
  // display. Ties break toward the later cluster: when an answer spans a long
  // arc, the recent end is nearly always the part being asked about.
  const years = clusters
    .map((c) => ({
      label: Math.round((c[0] + c[c.length - 1]) / 2),
      score: c.reduce((sum, y) => sum + (weight.get(y) ?? 0), 0),
    }))
    .sort((a, b) => b.score - a.score || b.label - a.label)
    .slice(0, 4)
    .sort((a, b) => a.label - b.label)
    .map((c) => c.label);

  const alreadyShown = new Set(parsed.citedIds);

  return years
    .map((year) => {
      const hits = locate({ year, spanYears, neighbors: 0 }).windows
        .flatMap((w) => w.hits)
        .filter((h) => !alreadyShown.has(h.id));
      return { year, hits: hits.slice(0, 12) };
    })
    .filter((g) => g.hits.length > 0);
}

export function corpusIds(): Set<string> {
  return new Set(BY_ID.keys());
}
