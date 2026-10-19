#!/usr/bin/env node
/**
 * guard-corpus.mjs - refuse to prepare the app from anything but the corpus's main.
 *
 * WHY. The prepare scripts read whatever the corpus folder (SILICON_ALTAR_REPO) has
 * checked out. On 2026-10-19 that folder had a side branch (the Mose game work)
 * checked out, cut before the Cahokia install: a rebuild from it would have served
 * the older research, and nothing would have looked wrong. A wrong build is a normal
 * build of the wrong data, so the check has to come before the read.
 *
 * Runs as the npm "pre" hook of each prepare script, so it covers `npm run dev`,
 * `build`, `build:check`, `vercel build` and a prepare script run by hand.
 *
 * PASSES only when the corpus folder
 *   1. has main checked out (not another branch, not a detached commit);
 *   2. has no uncommitted changes to tracked files (the windows are read from the
 *      generated HTML, so even date-stamp debris would be served);
 *   3. is not behind origin/main;
 *   4. is not ahead of origin/main except in docket/ (notes, not data).
 * origin is GitHub for the canonical folder, and the canonical folder for a
 * `git clone --local` of it (the deploy procedure): clone main, do not check out a
 * bare commit.
 *
 * If the fetch cannot reach origin, it compares with the last fetched origin/main
 * and says so; it does not block on the network.
 *
 *   SA_ALLOW_CORPUS_NOT_MAIN=1    override, for a deliberate test build
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const TAG = '  [corpus guard]';

if (process.env.SA_ALLOW_CORPUS_NOT_MAIN === '1') {
  console.log(`${TAG} SA_ALLOW_CORPUS_NOT_MAIN=1 set; not checking which corpus version is read.`);
  process.exit(0);
}

function readEnvLocal(key) {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
    const m = raw.match(new RegExp(`^${key}=(.*)$`, 'm'));
    return m ? m[1].trim() : null;
  } catch {
    return null;
  }
}

const REPO = process.env.SILICON_ALTAR_REPO || readEnvLocal('SILICON_ALTAR_REPO');
// A missing or unset path is the prepare script's error to report, with its own message.
if (!REPO || !fs.existsSync(REPO)) process.exit(0);

const git = (...args) => execFileSync('git', ['-C', REPO, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 20000 }).trim();

function refuse(why, fix) {
  console.error(`
  REFUSING TO PREPARE THE APP. The corpus it would read is not main.

  Corpus folder: ${REPO}
  ${why}

  The app would be built from this version and nothing would look wrong.
  ${fix}

  For a deliberate test build only:  SA_ALLOW_CORPUS_NOT_MAIN=1 <the same command>
`);
  process.exit(1);
}

try {
  git('rev-parse', '--git-dir');
} catch {
  refuse('It is not a git checkout, so its version cannot be checked.', 'Point SILICON_ALTAR_REPO at the corpus checkout.');
}

let branch = '';
try { branch = git('symbolic-ref', '--short', '-q', 'HEAD'); } catch { branch = ''; }
if (branch !== 'main') {
  const at = branch ? `branch "${branch}"` : `a detached commit (${git('rev-parse', '--short', 'HEAD')})`;
  refuse(`It has ${at} checked out.`,
    'Check out main there (commit or set aside other work first), or point SILICON_ALTAR_REPO at a\n  clean checkout of main. Side projects belong in their own worktree.');
}

const dirty = git('status', '--porcelain', '--untracked-files=no');
if (dirty) {
  const lines = dirty.split('\n');
  refuse(`It has uncommitted changes to ${lines.length} tracked file(s), for example:\n    ${lines.slice(0, 5).join('\n    ')}`,
    'Commit them, or discard them if they are regeneration debris (git checkout -- \'*_GENERATED.html\').');
}

let fetched = true;
try { git('fetch', '--quiet', 'origin', 'main'); } catch { fetched = false; }

let remote;
try { remote = git('rev-parse', 'refs/remotes/origin/main'); } catch {
  refuse('It has no origin/main to compare with.', 'Add the GitHub remote, or clone the corpus with git clone so origin is set.');
}

const behind = Number(git('rev-list', '--count', `HEAD..${remote}`));
if (behind > 0) {
  refuse(`Its main is ${behind} commit(s) behind origin/main.`, 'Run git pull in the corpus folder first.');
}

const ahead = Number(git('rev-list', '--count', `${remote}..HEAD`));
if (ahead > 0) {
  const data = git('diff', '--name-only', remote, 'HEAD').split('\n').filter((f) => f && !f.startsWith('docket/'));
  if (data.length) {
    refuse(`Its main has ${ahead} unpushed commit(s) that change data, for example:\n    ${data.slice(0, 5).join('\n    ')}`,
      'Push main first (merges and pushes are gated: ask the author), so what the app serves is on GitHub.');
  }
}

const head = git('rev-parse', '--short', 'HEAD');
const note = [
  ahead ? `${ahead} unpushed commit(s), docket/ only` : 'matches origin/main',
  fetched ? '' : 'origin not reachable; compared with the last fetch',
].filter(Boolean).join('; ');
console.log(`${TAG} corpus main @ ${head} (${note}).`);
process.exit(0);
