# The 22 stale saved findings, read and sorted

2026-09-21. `npm run records -- --stale` lists every saved finding whose target entry's wording has changed since the
finding was written (its `target_text_hash` no longer matches). On this date there were 22: the 21 reported earlier,
plus `sb-20260921-002`, the operator's own follow-up on the Utah entry, which went stale the same day it was corrected.

Each finding was read in full (summary and note) against the **full current text** of the entry it targets. Where a
finding made a factual claim about the corpus, that claim was checked against the corpus rather than taken from the
finding. **No record's status has been changed.** Setting statuses is the operator's decision.

What the tooling does and does not do: it detects the drift and records decisions (`--set ID STATUS reason`, append-only).
It cannot tell "the correction was made" from "the text moved for another reason". That takes reading, which is what this
document is.

## A. Done: the entry now says what the finding asked (3)

| record | entry | what it asked, and where it landed |
|---|---|---|
| sb-20260812-002 | E-W4-011-01 | Mortefontaine: the $20 million ran the other way (US assumed its own citizens' claims). The W4 claim check rewrote the entry to exactly that. The note's three uncarried French connections (Hortalez et Cie, Franklin and the Neuf Soeurs, the Cincinnati) are separate content leads. |
| sb-20260805-037 | E-W1-003-02 | Romanus Pontifex was not "jointly issued": Nicholas V issued it in January 1455 and died in March; Calixtus III reaffirmed it separately in 1456. The entry now says precisely that. The note's secondary point, that the hereditary-slavery reading is contested, remains, and is minor. |
| sb-20260921-002 | E-W6-016-01 | The "Utah Memorial" is really Dyett v. Turner. Corrected today. Two things in the finding itself: it calls Leander Perez a "Louisiana congressman", but the Record index lists the item as an inserted report by him, which is not the same thing; and it names a **second lead not yet checked, State v. Phillips (Utah, 1975)**, another Ellett opinion. |

## B. Partly done: the core fix landed; something it asked for remains (12)

| record | entry | done | still open |
|---|---|---|---|
| sb-20260805-004 | w3-1720-corporate | Body: the Act left chartered companies and partnership trade untouched; the colonial slave trade open since 1698. | **The title still says "sole joint-stock franchise... foreclosing competitor Track A operators", and the body's last sentence still says both tracks are held by single operators with statutory monopoly. Both contradict the corrected sentence between them.** Harris (1994) not cited. |
| sb-20260805-006 | w3-1718-sovereign | Body corrected in the W3 claim check to "a Creek policy of neutrality". The finding's claim that "Coweta Resolution" is corpus coinage is **contradicted by the row's own sources** (Encyclopedia of Alabama, New Georgia Encyclopedia). | **The title still says Brim "locks Britain, France, and Spain into 45-year Creek neutrality", contradicting the corrected body.** The 45-year span. |
| sb-20260805-001 | E-W5-016-04 | The incorporation is now labelled the corpus's inference, and "for municipal purposes" quoted. | The purpose (consolidating three jurisdictions), the 1874 abolition, and "Constitution OF replaces Constitution FOR", still stated as fact. |
| sb-20260805-005 | w3-1776-sovereign | Now framed "Read through the Trustee Hierarchy framework", so labelled as the corpus's reading. | The narrower restatement it proposes (sovereignty changed, the creditor network did not). A framework choice your Option 1 ruling already lets you decline. |
| sb-20260805-011 | w3-1717-legal | The 1713 Asiento event now exists (four rows). | Still missing: `yamasee-war-1715`, `vagabonds-act-1597`, `settlement-act-1662`, `south-sea-bubble-crash-1720`. The generator lists `yamasee-war-1715` among broken correlation targets. |
| sb-20260805-013 | w3-1718-forward-financial | The 1713 gap is closed, and the Rhode Island 1708 duty is already in the corpus (w3-1703-legal, w3-1708-financial). | The corpus does not mark the £3 / £3 parallel, or say whether it is transmission or independent reinvention. |
| sb-20260805-030 | E-W5-051-01 | Title now "its buildings return to the Army"; body "WWI hospital". Pratt's words are now at E-W5-023-01. | The outing system and the school cemetery are not carried (content gaps, not corrections). |
| sb-20260810-001 | E-W6-010-01 | 1836, not 1787. | "sovereignty provisions were NEVER TESTED" is still in the entry. |
| sb-20260805-039 | E-W1-020-02 | "persists in practice past the 1601/1609 reforms" meets its overlap point in part. | Population collapse and Crown consolidation as drivers of the shift. |
| sb-20260806-006 | w3-1750-financial | The survival claim is now labelled "The corpus reads the classification as surviving the wrapper". | No carriage-volume evidence (Voyages Database) behind it. |
| sb-20260806-009 | w3-1720-financial | "scholars read it as protecting the South Sea Company", and a sourced quotation. | "preemptive legal armor" (the N1 pattern) is stated unlabelled; the contested causal reading is not given. |
| sb-20260806-010 | E-W5-016-01 | The W5 claim check replaced "30 killed" with the state's seven and historians' thirty. | Its real point is depth: the entry is still a one-line pointer to a testimony volume that is open and could be mined. |

## C. Still stands: the text moved for another reason; the finding is untouched (7)

| record | entry | the finding |
|---|---|---|
| sb-20260804-006 | E-W5-044-01 | Jekyll Island produced the Aldrich Plan, which failed in 1912; the 1913 Act was Glass-Owen and differed on the points the attendees cared about. The body still reads "Secret - designs Fed Reserve". Only the title changed. |
| sb-20260805-035 | E-W6-010-01 | "never tested" conflates "not litigated" with "open": a bilateral treaty gives no private standing, which answers the question structurally. |
| sb-20260805-024 | E-W0-003-01 | Corpus-wide: framework constructs sit in tier A entries reading as established; the sovereign-citizen lineage of the 1871, HJR 192 and birth-certificate arguments is not noted. The entry changed only for the 1905 date. |
| sb-20260805-028 | E-W5-054-01 | Tulsa, Rosewood and Plecker as one operation on records; verify the "physically cut" Tulsa Tribune claim at E-W5-054-03. |
| sb-20260805-031 | E-W5-056-02 | Disclose the Laughlin and Grant link between the 1924 statutes. Its premise that the "third law" is unnamed is off: the entry names the Indian Citizenship Act; the Eugenical Sterilization Act would be a fourth. |
| sb-20260805-038 | E-W1-011-01 | Distinguish imperium from dominium: the Discovery instruments allocate sovereignty among Europeans, not title to soil. |
| sb-20260805-042 | E-W2-025-02 | Thread the six pre-1676 racial-status instruments to Bacon, as acceleration rather than origin. |

## What this reading found beyond the list

**Two titles contradict their own corrected bodies**, both in W3 and both corrected in the body by the W3 claim check
without the title following: w3-1720-corporate ("sole joint-stock franchise") and w3-1718-sovereign ("locks Britain,
France, and Spain"). This is the same shape as the East India Company title fixed in W5. A corpus-wide pass for titles
that contradict their own bodies may be worth running; this reading only covers the 22 rows it touched.

**Most of B and C are framework questions, not factual ones.** They ask the corpus to restate its reading, and your Option
1 ruling already says a labelled framework reading may stay. Those are yours to accept, defer or decline, not mine to fix.

## Recording the outcome, when decided

The mechanism is the one used for `sb-20260804-001` (commit 9028a40): append a line for the record with a correction note
and the target re-pinned to the current wording, via `npm run records -- --set ID STATUS "reason"`. Nothing has been set.
