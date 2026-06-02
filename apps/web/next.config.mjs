// A per-build identifier inlined into client bundles via
// process.env.NEXT_PUBLIC_BUILD_ID. Lets global-error.tsx scope
// its one-time recovery flags to the current build so a future
// deploy never reuses a stale flag that would silently suppress
// the recovery on the next failure.
const BUILD_ID = process.env.BUILD_ID || String(Date.now());

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  env: {
    NEXT_PUBLIC_BUILD_ID: BUILD_ID,
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [],
  },
  async headers() {
    // Defeats the "application error on first load, works after
    // refresh" pattern. nginx / CDN in front of the app cached
    // HTML that referenced chunk hashes from the previous build;
    // a new build replaced those chunks; the browser failed to
    // load them and the root client raised before any route-level
    // error boundary mounted. We pin two contracts:
    //
    //   /_next/static/*  -> immutable, cache forever (hashed paths)
    //   everything else  -> never cache HTML; revalidate every hit
    //
    // global-error.tsx auto-reloads the last-mile case where a
    // user already has a stale chunk in flight.
    return [
      {
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/:path*',
        has: [{ type: 'header', key: 'accept', value: '.*text/html.*' }],
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
        ],
      },
    ];
  },
};

export default nextConfig;
