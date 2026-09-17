#!/usr/bin/env node
/**
 * guard-dev-port.mjs - refuse `npm run build` while a dev server is running.
 *
 * WHY. `next dev` and `next build` both write the SAME output directory, and
 * next.config.mjs sets no distDir, so both use `.next`. The dev server keeps an
 * in-memory map of dev-mode chunks; a build overwrites `.next` with production
 * chunks under different names; the still-running dev server then requires a file
 * that no longer exists and every route 500s with
 *
 *     Error: Cannot find module './638.js'
 *       at .next/server/webpack-runtime.js
 *
 * That happened on 2026-09-17: a build run to verify a merge killed the operator's
 * live app mid-session. Recovery is `rm -rf .next` and restart, which is cheap, but
 * the outage is not, and nothing warned.
 *
 * SCOPE, deliberately narrow. This guards the npm `build` script only. The
 * Dockerfile runs `npx next build` directly (see docs/DEPLOY.md section 2, the
 * container has no audit repo so it cannot run the prepare steps), so the deploy
 * path never reaches this file and cannot be blocked by it.
 *
 * FAILS OPEN. If the port cannot be tested for any reason other than being in use,
 * this exits 0 with a warning. A broken check must never block a legitimate build.
 *
 *   SA_DEV_PORT=3210              port to test
 *   SA_ALLOW_BUILD_WITH_DEV=1     override, for when you mean it
 */
import net from 'node:net';

const PORT = Number(process.env.SA_DEV_PORT || 3210);

if (process.env.SA_ALLOW_BUILD_WITH_DEV === '1') {
  console.log(`  [guard] SA_ALLOW_BUILD_WITH_DEV=1 set; not checking port ${PORT}.`);
  process.exit(0);
}

/*
 * CONNECT, do not bind. The first version of this guard bound 127.0.0.1:3210 and
 * PASSED while a dev server was live, because next dev holds the wildcard on IPv6
 * (lsof: "node ... IPv6 ... TCP *:3210 (LISTEN)") and an IPv4 loopback bind does
 * not collide with it on macOS. The guard ran, reported clear, and the build went
 * ahead - which is the exact failure it exists to prevent, wearing the costume of
 * a passing check.
 *
 * A successful CONNECT is unambiguous: something is listening and answering,
 * whatever interface or family it holds. Both loopback families are tried.
 */
function inUse(host) {
  return new Promise((resolve) => {
    const sock = net.connect({ host, port: PORT });
    const done = (v) => { sock.destroy(); resolve(v); };
    sock.setTimeout(1500);
    sock.once('connect', () => done(true));
    sock.once('timeout', () => done(false));
    sock.once('error', () => done(false));   // ECONNREFUSED = nothing there
  });
}

const held = (await inUse('127.0.0.1')) || (await inUse('::1'));

if (held) {
  console.error(`
  REFUSING TO BUILD. Something is listening on port ${PORT}, which means a dev or
  production server is running from this directory.

  next dev and next build share the .next output directory. Building now would
  overwrite what the running server is serving, and every route would 500 with
  "Cannot find module './###.js'" until .next is deleted and the server restarted.

  Pick one:

    npm run build:check      verify the build WITHOUT touching .next  <- usually this
    <stop the server>        then npm run build
    SA_ALLOW_BUILD_WITH_DEV=1 npm run build    if you mean it

  This guard does not run in Docker: the Dockerfile calls npx next build directly.
`);
  process.exit(1);
}

process.exit(0);
