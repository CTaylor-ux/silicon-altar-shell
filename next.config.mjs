/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Window HTML is served straight from public/windows as static assets.
  // It is never processed by the bundler — that is deliberate: the documents
  // must reach the browser byte-for-byte as the generator emitted them.
};

export default nextConfig;
