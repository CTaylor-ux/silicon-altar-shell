/**
 * stub-index.ts — hand-built question -> entry mappings.
 *
 * Every target below is a REAL entry id, year, lane and tier taken from
 * entries.json. Every answer is a compression of that entry's own body text.
 * Nothing here is invented, because a mockup that demos on fabricated corpus
 * content would be the exact failure mode this project audits for.
 *
 * FUTURE: deleted wholesale once lib/retrieval.ts calls a real backend. It
 * exists only to make the answer -> location linkage evaluable.
 */

import type { Target } from './retrieval';

type StubRow = {
  /** lowercase single tokens; naive overlap scoring in retrieval.ts */
  match: string[];
  answer: string;
  scopeNote?: string;
  targets: Target[];
};

export const STUB_INDEX: StubRow[] = [
  {
    match: ['rhode', 'island', 'slavery', 'statute', 'anti', 'legalize', '1652', '1703'],
    answer:
      'Rhode Island passed a first-in-nation anti-slavery statute in 1652 and formally recognised slavery in 1703. The 1652 statute bound only Providence and Warwick: Newport and Portsmouth, the actual trading centres, were exempt by geography, and no enforcement mechanism was written. The 1703 Assembly ends the fifty-one-year fiction.',
    scopeNote:
      'The statute text and the 1703 recognition are sourced. Reading the 1652 act as "legal cover rather than legal prohibition" is the corpus\'s interpretation.',
    targets: [
      { entryId: 'w3-1652-legal', windowId: 3, year: '1652', lane: 'legal', tier: 'A', title: 'Rhode Island Providence-Warwick anti-slavery statute passed by Assembly, structurally never enforced' },
      { entryId: 'w3-1703-legal', windowId: 3, year: '1703', lane: 'legal', tier: 'A', title: 'Rhode Island General Assembly formally recognizes slavery, structurally voids the 1652 Providence-Warwick statute' },
    ],
  },
  {
    match: ['ellis', 'island', 'fire', 'immigration', 'records', 'destroyed', 'destruction'],
    answer:
      'Ellis Island opened in 1892 and its records burned in 1897. The corpus files the opening under Information Architecture, covered as a symbol of American opportunity rather than as a population pipeline, and the fire under Records / Archives.',
    targets: [
      { entryId: 'E-W5-031-01', windowId: 5, year: '1892', lane: 'information', tier: 'B', title: 'Ellis Island opens' },
      { entryId: 'E-W5-035-01', windowId: 5, year: '1897', lane: 'records', tier: 'A', title: 'Ellis Island fire' },
    ],
  },
  {
    match: ['moors', 'sundry', 'act', 'root', 'password', 'moorish', '1790'],
    answer:
      'The Moors Sundry Act of 1790: 1st Congress, 2nd Session, p. 103. Free Moors petitioned against the South Carolina Negro Act of 1740, and Congress recognised Moorish nationals as distinct from "Negroes." The corpus treats this as the root password: a federal acknowledgement of separate standing.',
    targets: [
      { entryId: 'E-W4-002-02', windowId: 4, year: '1790', lane: 'counter-move', tier: 'A', title: 'Moors Sundry Act THE ROOT PASSWORD' },
    ],
  },
  {
    match: ['discovery', 'doctrine', 'dum', 'diversas', 'papal', 'bull', '1452', 'begin', 'origin'],
    answer:
      'Dum Diversas, 1452. Nicholas V grants Alfonso V of Portugal authority to subdue Saracens, pagans and other unbelievers "wheresoever placed," and to reduce their persons to perpetual servitude. The corpus reads this as the installation point of the Discovery Doctrine\'s legal genome.',
    scopeNote:
      'The bull\'s text is Tier A. The "software installation" framing is the corpus\'s own model, not a claim of the source.',
    targets: [
      { entryId: 'E-W1-001-02', windowId: 1, year: '1452', lane: 'legal', tier: 'A', title: 'Dum Diversas: Papal authorization for perpetual enslavement of non-Christians' },
      { entryId: 'E-W1-001-03', windowId: 1, year: '1452', lane: 'counter-move', tier: 'A', title: "Software installation: the Discovery Doctrine's legal genome activated" },
    ],
  },
  {
    match: ['a00', 'dna', 'haplogroup', 'chromosome', 'old', 'age', 'lineage', 'biological'],
    answer:
      'Mendez et al. (2013) place the A00 Y-chromosome haplogroup at a time-to-most-recent-common-ancestor of 338,000 years, 95% CI 237,000 to 581,000.',
    scopeNote:
      'The estimate is disputed and the corpus records the dispute: Elhaik gives 208,300 (CI 163,900 to 260,200); Krahn, A00\'s own discoverer, is nearer 200,000. The entry is Tier A on the paper, not on the settlement of the question.',
    targets: [
      { entryId: 'E-W0-013-01', windowId: 0, year: '338K BP', lane: 'population', tier: 'A', title: 'A00 Y-chromosome: biological title with 338,000-year documented presence' },
    ],
  },
  {
    match: ['birth', 'certificate', 'registration', 'sheppard', 'towner', 'financial', 'instrument', '1921'],
    answer:
      'The Sheppard-Towner Maternity Act, 23 November 1921, the first federal social welfare program. The mechanism is the conditional: to receive federal funds, states had to establish uniform birth registration. By 1929 every state had complied.',
    scopeNote:
      'The Act and the funding condition are sourced. The Noun-to-Adjective conversion at the moment of registration is the corpus\'s reading.',
    targets: [
      { entryId: 'E-W6-001-01', windowId: 6, year: '1921', lane: 'financial', tier: 'B', title: 'Sheppard-Towner Maternity Act - BIRTH REGISTRATION AS FINANCIAL INSTRUMENT' },
      { entryId: 'E-W6-001-03', windowId: 6, year: '1921', lane: 'certification', tier: 'B', title: 'Birth certificate as certification event' },
    ],
  },
  {
    match: ['havana', 'drew', 'ali', 'conference', 'pan', 'american', '1928'],
    answer:
      'The Sixth International Conference of American States, Havana, 16 January to 20 February 1928. Twenty-one nations; Coolidge opened, Hughes led the U.S. delegation. Drew Ali\'s physical presence is verified by a Brill academic handbook and the S.S. Northland shipping record of 25 January.',
    targets: [
      { entryId: 'E-W5-060-01', windowId: 5, year: '1928', lane: 'counter-move', tier: 'B', title: '★ Drew Ali at the Pan-American Conference, Havana' },
    ],
  },
  {
    match: ['dawes', 'act', 'allotment', 'rolls', 'blood', 'quantum', 'classification', '1887'],
    answer:
      'The Dawes Act of 1887 took 86 million acres. The corpus argues the Act is only half the weapon: the Dawes Rolls (1898 to 1914) are the other half, a classification engine deciding blood quantum and assigning identity.',
    scopeNote:
      'Acreage and the Rolls are sourced. Reading the Rolls as structurally identical to Plecker\'s apparatus is the corpus\'s comparison.',
    targets: [
      { entryId: 'E-W5-027-03', windowId: 5, year: '1887', lane: 'legal', tier: 'B', title: 'Dawes Act - Allotment + Classification' },
    ],
  },
  {
    match: ['quartz', 'spruce', 'pine', 'silicon', 'chip', 'flotation', 'geological', 'orogeny'],
    answer:
      'Two entries, 300 million years apart. The Alleghanian Orogeny welded Laurentia and Gondwana around 300 Ma: the North Carolina Appalachians and the Moroccan Anti-Atlas are the same formation. Froth flotation, developed 1944 to 1949 at NC State\'s Minerals Research Lab, is what made Spruce Pine quartz purifiable.',
    scopeNote:
      'The geology is Tier A; the froth-flotation entry is Tier C. What Spruce Pine supplies is the fused-quartz crucible, not the crystal in the chip.',
    targets: [
      { entryId: 'E-W0-011-01', windowId: 0, year: '~300 Ma', lane: 'counter-move', tier: 'A', title: 'Alleghanian Orogeny: geological title predates every Managerial instrument by 300 million years' },
      { entryId: 'E-W6-007-05', windowId: 6, year: '1944', lane: 'innovation', tier: 'C', title: 'Froth flotation - Spruce Pine quartz purified' },
    ],
  },
  {
    match: ['bankruptcy', 'gold', 'seizure', 'hjr', '192', 'mcfadden', '6102', '1933'],
    answer:
      'Three instruments in 1933: Executive Order 6102 (5 April) requiring surrender of gold at $20.67/oz before revaluation to $35, a 69% overnight seizure; House Joint Resolution 192 (5 June) suspending the gold standard; and the McFadden charges.',
    targets: [
      { entryId: 'E-W6-002-01', windowId: 6, year: '1933', lane: 'financial', tier: 'A', title: 'BANKRUPTCY #3 - HJR 192, Gold Seizure & McFadden Charges' },
    ],
  },
];

/** Shown in the query bar's idle state. Real questions the stub can answer. */
export const SUGGESTED_QUERIES = [
  'Where does Rhode Island legalize slavery?',
  'What happened to the Ellis Island records?',
  'How old is the A00 lineage?',
  'Where does the Discovery Doctrine begin?',
];
