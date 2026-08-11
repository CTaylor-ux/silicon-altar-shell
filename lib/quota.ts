/**
 * quota.ts — per-person and global daily caps on the answering layer.
 *
 * THE CAP IS DERIVED FROM THE RECORDS, NOT FROM A COUNTER.
 *
 * Every answered question already appends a record carrying `surfaced_by` and
 * `captured_at`. Counting today's records for a person IS their usage, so there
 * is no second store to keep in step and nothing to reconcile: what a person was
 * charged against is exactly what the corpus recorded them asking. A separate
 * counter would be one more thing that can disagree with the log, and this
 * project has been bitten enough times by measurements that drifted from the
 * thing they measured.
 *
 * It also survives restart for free, which an in-memory counter does not.
 *
 * MEASURED COST BASIS, from records/queries.jsonl (64 records):
 *   ~$0.19  per query on a warm cache
 *   ~$1.45  to write the cache cold, once per sitting (1h TTL, a read refreshes)
 *   ~$21    total spent across every recorded query to date
 *
 * So the defaults below are worth about $4.75 per person per day and about
 * $11.40 per day across everyone, plus a cold write per sitting. Both are env
 * -tunable; raise them once the beta shows what a real sitting looks like.
 *
 * ONE THING THIS CANNOT SEE. Records are appended after the model call returns,
 * and `/api/ask` deliberately swallows an append failure so a lost record never
 * costs the reader their answer. A person whose appends were all failing would
 * therefore not accrue quota. That is what BURST_SECONDS is for: it is in-process
 * and does not depend on the log, so a runaway client is capped even when the
 * record layer is broken.
 */

import { readRecords } from './record';

const DEFAULTS = {
  perPersonPerDay: 25,
  globalPerDay: 60,
  burstSeconds: 5,
};

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function limits() {
  return {
    perPersonPerDay: envInt('BETA_DAILY_PER_PERSON', DEFAULTS.perPersonPerDay),
    globalPerDay: envInt('BETA_DAILY_GLOBAL', DEFAULTS.globalPerDay),
    burstSeconds: envInt('BETA_MIN_SECONDS_BETWEEN', DEFAULTS.burstSeconds),
  };
}

/** UTC day, matching how record ids are stamped so a person's cap and their
 *  record numbering roll over together. */
function utcDay(iso: string): string {
  return iso.slice(0, 10);
}

export type Usage = { mine: number; everyone: number; day: string };

export function usageToday(personId: string): Usage {
  const day = new Date().toISOString().slice(0, 10);
  let mine = 0;
  let everyone = 0;
  for (const r of readRecords()) {
    if (!r.captured_at || utcDay(r.captured_at) !== day) continue;
    everyone++;
    if (r.surfaced_by === personId) mine++;
  }
  return { mine, everyone, day };
}

/* In-process, per person. Deliberately not persisted: its job is to stop a
   runaway loop inside one server lifetime, which is precisely the window where
   the record-derived count can be blind. */
const lastSeen = new Map<string, number>();

export type QuotaVerdict =
  | { ok: true; usage: Usage }
  | { ok: false; status: number; error: string; retryAfterSeconds?: number };

export function checkQuota(personId: string): QuotaVerdict {
  const { perPersonPerDay, globalPerDay, burstSeconds } = limits();
  const now = Date.now();

  const prev = lastSeen.get(personId);
  if (prev !== undefined && burstSeconds > 0) {
    const elapsed = (now - prev) / 1000;
    if (elapsed < burstSeconds) {
      return {
        ok: false,
        status: 429,
        error: `Too quick. Wait ${Math.ceil(burstSeconds - elapsed)}s and ask again.`,
        retryAfterSeconds: Math.ceil(burstSeconds - elapsed),
      };
    }
  }

  const usage = usageToday(personId);

  if (globalPerDay > 0 && usage.everyone >= globalPerDay) {
    return {
      ok: false,
      status: 429,
      error:
        `The whole beta has reached today's shared limit of ${globalPerDay} questions. ` +
        `It resets at 00:00 UTC. Tell the operator if you needed more than this today.`,
    };
  }

  if (perPersonPerDay > 0 && usage.mine >= perPersonPerDay) {
    return {
      ok: false,
      status: 429,
      error:
        `You have asked ${usage.mine} questions today, which is this beta's per-person limit. ` +
        `It resets at 00:00 UTC. Locate still works, and so do the windows.`,
    };
  }

  /* Stamped on the way IN. The alternative is stamping after a successful
     answer, which would let a client fire a hundred concurrent requests through
     the gap between check and completion. */
  lastSeen.set(personId, now);
  return { ok: true, usage };
}
