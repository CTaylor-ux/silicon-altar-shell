#!/usr/bin/env node
/**
 * invite.mjs — mint, list and revoke invite codes.
 *
 *   npm run invite -- --name "Jane Rowan"                  a researcher
 *   npm run invite -- --name "Colin Taylor" --operator     the operator
 *   npm run invite -- --list
 *   npm run invite -- --revoke jane-rowan
 *
 * The code is printed ONCE, at mint time. It is stored in invites.json, which
 * is gitignored, and there is no recovery path other than reading that file —
 * which is the same thing as having it, so nothing is protected by pretending
 * otherwise. Revoke and re-mint if one goes astray.
 *
 * An id is stable and permanent: it is written into `surfaced_by` on every
 * record that person creates, and records are append-only. Never reuse one for
 * a different human, because doing so silently reassigns their history.
 */

import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

const FILE = path.join(process.cwd(), 'invites.json');

function read() {
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return Array.isArray(parsed) ? parsed : (parsed.invites ?? []);
  } catch {
    return [];
  }
}

function write(list) {
  fs.writeFileSync(FILE, JSON.stringify({ invites: list }, null, 2) + '\n', 'utf8');
  fs.chmodSync(FILE, 0o600);
}

function slug(name) {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40);
}

function arg(flag) {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : null;
}
const has = (flag) => process.argv.includes(flag);

const list = read();

/* ------------------------------------------------------------------- --list */
if (has('--list')) {
  if (!list.length) {
    console.log('\n  No invites yet. Mint one with:  npm run invite -- --name "Their Name"\n');
    process.exit(0);
  }
  console.log(`\n  ${list.length} invite(s) in ${FILE}\n`);
  for (const i of list) {
    const exp = i.expires ? `  expires ${i.expires.slice(0, 10)}` : '';
    console.log(`  ${i.id.padEnd(24)} ${i.role.padEnd(11)} ${i.name}${exp}`);
    if (i.note) console.log(`  ${''.padEnd(24)} ${i.note}`);
  }
  console.log('\n  Codes are not shown. They exist only in the file.\n');
  process.exit(0);
}

/* ----------------------------------------------------------------- --revoke */
const revoke = arg('--revoke');
if (revoke) {
  const before = list.length;
  const kept = list.filter((i) => i.id !== revoke);
  if (kept.length === before) {
    console.error(`\n  No invite with id "${revoke}". Run --list to see them.\n`);
    process.exit(1);
  }
  write(kept);
  console.log(`\n  Revoked ${revoke}. Their existing session cookie stays valid until it`);
  console.log('  expires; rotate SESSION_SECRET to cut every session immediately.\n');
  console.log('  Their records are untouched and keep their attribution.\n');
  process.exit(0);
}

/* ------------------------------------------------------------------- mint */
const name = arg('--name');
if (!name) {
  console.error('\n  Usage: npm run invite -- --name "Their Name" [--operator] [--id custom-id]');
  console.error('         npm run invite -- --list');
  console.error('         npm run invite -- --revoke <id>\n');
  process.exit(1);
}

const id = arg('--id') || slug(name);
if (list.some((i) => i.id === id)) {
  console.error(`\n  An invite with id "${id}" already exists.`);
  console.error('  Ids are permanent because they are written into every record that person');
  console.error('  creates. Pass --id to choose a different one, or --revoke first.\n');
  process.exit(1);
}

const invite = {
  id,
  name,
  role: has('--operator') ? 'operator' : 'researcher',
  token: randomBytes(32).toString('hex'),
  ...(arg('--note') ? { note: arg('--note') } : {}),
  ...(arg('--expires') ? { expires: arg('--expires') } : {}),
};

write([...list, invite]);

console.log(`\n  Minted ${invite.role} invite for ${invite.name}`);
console.log(`  id:   ${invite.id}   (permanent — this is their surfaced_by)`);
console.log(`\n  code: ${invite.token}\n`);
console.log('  Send that code to them. It is shown once here and stored in invites.json,');
console.log('  which is gitignored. They redeem it at /enter.\n');

if (invite.role === 'operator') {
  console.log('  Operator: add this line to .env.local so `npm run keepwarm` can sign in:');
  console.log(`    SA_INVITE_TOKEN=${invite.token}\n`);
}
