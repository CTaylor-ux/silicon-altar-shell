/**
 * landing-content.ts — the landing page's words that are not corpus data.
 *
 * Every factual line here was checked against the corpus in Thread 37
 * (2026-10-03); the corrections are ones the corpus actually made, with the
 * record of each in its docket. Figures come from lib/landing.generated.json.
 */

export const HERO = {
  title: 'See what the records say, and how sure anyone can be.',
  line: 'The Silicon Altar is a private archive of how law, land and money turned people into property, from the deep past to today. Every claim shows its sources, which of them were actually read, and which explanations still stand.',
};

/** The record in the opening, and the honest note under it. The quotation is the
 *  dossier's, confirmed on 2026-10-03 against Encyclopedia Virginia's transcription of
 *  the order book (via Billings 1975). The manuscript itself is unopened. */
export const OPENING_RECORD = {
  quote: 'He had him for his life',
  who: 'Anthony Johnson, claiming John Casor before the Northampton County court, Virginia, 1655',
  note: "The archive checked this line against a published transcription of the county's order book. It has not opened the manuscript itself, and it says so.",
};

/** How the dossier is read: three plain points beside the live example. */
export const HOW = [
  { title: 'The verdict is split where it should be.', text: 'What the court decided is proven. The idea that it was planned is only a reading, and it is labelled as one.' },
  { title: 'Every source says whether anyone opened it.', text: 'Read means someone has opened the document itself. Cited means it is named but not yet checked. The gaps stay visible.' },
  { title: 'The other explanations stay on the page.', text: 'Each one carries its verdict and the reason for it. Open one to see the argument.' },
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
  { year: '1670', text: 'After his death, the county takes land his family held. The finding says he', quote: 'was a negro and by consequence an alien' },
  { year: '1704', text: 'The family had left for Maryland in 1665 and leased land there. His son John ended his life in Delaware, kept by the county as', quote: 'Poor and Past his Labour' },
];

export const AUDIENCES = [
  { title: 'Heirs', text: 'People with proven blood-right claims to the Americas under jus sanguinis, the right of blood, where standing comes from lineage, treaty and DNA. The archive shows them what was done to their families, how it was recorded, and how sure anyone can be of it.' },
  { title: 'Researchers', text: 'Bring your sources and your method. Challenge a row against its document. What you bring is credited to you, and you see what became of it.' },
  { title: 'Educators', text: 'Every claim is a lesson in how to read a record: who wrote it, what it says, what is inferred, and what is still argued.' },
];

export const TRUST = [
  { title: 'What is recorded', text: 'Your code is yours alone. The questions you ask and the sources you bring are recorded under your name, so you can be shown what became of them.' },
  { title: 'The standard', text: "A source counts as read only when someone has opened the document itself. A claim the corpus infers is labelled as the corpus's reading." },
  { title: 'Corrections', text: 'When a row is wrong it is corrected, and the record of the correction is kept.' },
];

export const MOTTO = 'The estate remains. The management contract has expired.';

/** What happens after someone asks for an invitation. Kept true to the route:
 *  the request is saved beside the app and read by the author. */
export const AFTER_REQUEST = [
  'The author reads every request personally.',
  'If it is a fit, you receive a personal code by email.',
  'Your code opens all seven windows, the dossiers, the maps and the question box.',
];
