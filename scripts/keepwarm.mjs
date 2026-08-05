#!/usr/bin/env node
/**
 * keepwarm.mjs — hold the corpus cache open across breaks.
 *
 *   npm run keepwarm          (leave running in a second terminal)
 *
 * One hour is the longest cache the API offers and there is no setting to
 * extend it. A read refreshes the clock, though, so a touch every 50 minutes
 * keeps one entry alive indefinitely. About $0.08 a touch against $1.50 to
 * rebuild from cold — worth it across any break longer than roughly an hour,
 * pointless if you are asking questions steadily, since those refresh it
 * themselves.
 *
 * The work happens in /api/warm inside the app, not here, so the warmed prefix
 * is byte-identical to the real one by construction. A copy of the prompt in
 * this file would drift within a day and warm a cache no question ever reads.
 *
 * A separate process on purpose rather than a timer inside the app: a timer in
 * a hot-reloading dev server multiplies on every edit, and you would be paying
 * for touches you cannot see. This one you started and can watch.
 */

const EVERY_MIN = 50; // under the 1h TTL, with room for a slow request
const URL = process.env.SA_URL || 'http://localhost:3210';

let touches = 0;
let spent = 0;

async function touch() {
  const t0 = Date.now();
  const now = new Date().toTimeString().slice(0, 5);
  try {
    const res = await fetch(`${URL}/api/warm`, { method: 'POST' });
    const d = await res.json();

    if (!res.ok) {
      console.error(`  ${now}  failed: ${d.error ?? res.status}`);
      if (res.status === 503) console.error('    no API key — check .env.local');
      return;
    }

    touches += 1;
    spent += d.costUsd;
    const kind = d.write ? `WRITE ${d.write.toLocaleString()}` : `read ${d.read.toLocaleString()}`;
    console.log(
      `  ${now}  ${kind}  ~$${d.costUsd.toFixed(3)}` +
        `   (${touches} touches, $${spent.toFixed(2)} total, ${Date.now() - t0}ms)`
    );
    if (d.write) {
      console.log('    cache was cold — it expired, or the prompt changed since the last touch');
    }
  } catch (e) {
    console.error(`  ${now}  unreachable: ${e.message}`);
    console.error(`    is the dev server up on ${URL}?`);
  }
}

console.log(`\n  Keeping the corpus cache warm at ${URL}.`);
console.log(`  Touch every ${EVERY_MIN} min. ~$0.08 each, against $1.50 to rebuild cold.`);
console.log('  Ctrl-C to stop.\n');

await touch();
setInterval(touch, EVERY_MIN * 60 * 1000);

process.on('SIGINT', () => {
  console.log(`\n  Stopped. ${touches} touches, $${spent.toFixed(2)} total.\n`);
  process.exit(0);
});
