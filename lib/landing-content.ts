/**
 * landing-content.ts — the landing page's words that are not corpus data.
 *
 * Every factual line here was checked against the corpus in Thread 37
 * (2026-10-03); the corrections are ones the corpus actually made, with the
 * record of each in its docket. Figures come from lib/landing.generated.json.
 */

export const HERO = {
  kicker: 'A forensic audit of the American Levant',
  title: 'The Silicon Altar',
  line: 'Seven windows of records, from the eleventh century to now. Every claim shows its evidence: what was read, what was not, and what is still argued.',
};

export const STEPS = [
  { n: '01', title: 'Read the claim', text: 'Every row is a claim, set in its year and its lane: the law, the land, the money, the people.' },
  { n: '02', title: 'See how sure it is', text: 'Open the dossier. The verdict is split where it should be: what is proven, and what is only a reading.' },
  { n: '03', title: 'Check the sources', text: 'Each source says whether anyone has opened it, or only cited it. Gaps are shown, not hidden.' },
  { n: '04', title: 'Weigh the alternatives', text: 'The explanations the corpus considered stay on the page, each with its verdict: eliminated, holding or held.' },
];

/** Corrections the corpus made to itself, publicly recorded. */
export const CORRECTIONS = [
  {
    was: "An 1845 speech naming the people beyond the Rio Grande 'Mauritanian' and 'Moorish' was credited to Charles Hudson.",
    now: 'The Congressional Globe of 6 January 1845 shows the speaker was Charles J. Ingersoll, chairman of the House Committee on Foreign Affairs. The row now says so.',
  },
  {
    was: "Haiti's 1825 indemnity was described as ten times the price of the Louisiana Purchase.",
    now: "On the corpus's own figures it was a little under twice. The ordinance itself was read, and the lender, the comparison and the end date were corrected.",
  },
  {
    was: "Morocco's 1777 declaration was called the first sovereign recognition of the United States, as fact.",
    now: 'The State Department dates recognition to the 1786 treaty. The row now gives all three datings the sources give, and says which is which.',
  },
];

export const JOHNSON = [
  { year: '1655', text: 'A Virginia court sends John Casor back into the service of Anthony Johnson, a free Black landholder, who claimed him for life.' },
  { year: '1657', text: "A neighbour takes a hundred acres of Johnson's land over a debt letter that was allegedly forged." },
  { year: '1670', text: "After his death, the county takes land his family held, finding that he 'was a negro and by consequence an alien.'" },
];

export const AUDIENCES = [
  { title: 'Heirs', text: 'People tracing what was done to their families, and how it was recorded. The archive shows the record, and how sure anyone can be of it.' },
  { title: 'Researchers', text: 'Bring your sources and your method. Challenge a row against its document. What you bring is credited to you, and you see what became of it.' },
  { title: 'Educators', text: 'Every claim is a lesson in how to read a record: who wrote it, what it says, what is inferred, and what is still argued.' },
];

export const TRUST = [
  { title: 'What is recorded', text: 'Your code is yours alone. The questions you ask and the sources you bring are recorded under your name, so you can be shown what became of them.' },
  { title: 'The standard', text: "A source counts as read only when someone has opened the document itself. A claim the corpus infers is labelled as the corpus's reading." },
  { title: 'Corrections', text: 'When a row is wrong it is corrected, and the record of the correction is kept.' },
];

export const MOTTO = 'The estate remains. The management contract has expired.';
