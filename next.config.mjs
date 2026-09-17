/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Window HTML is served straight from public/windows as static assets.
  // It is never processed by the bundler — that is deliberate: the documents
  // must reach the browser byte-for-byte as the generator emitted them.

  // Emits .next/standalone with only the modules actually reached, so the
  // container does not carry node_modules. See docs/DEPLOY.md — the deploy
  // target is a host with a persistent volume, NOT a serverless one, because
  // records/queries.jsonl is written at runtime and losing it would lose the
  // only thing the beta exists to collect.
  output: 'standalone',
};

export default nextConfig;
