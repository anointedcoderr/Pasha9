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
  async rewrites() {
    // /favicon.ico is the legacy browser convention - tabs,
    // bookmarks, history-search-suggestions, and the Google
    // crawler all probe it directly, often skipping the HTML
    // <link rel="icon"> tag. We rewrite the legacy path to the
    // same dynamic /icon route handler so the operator's freshly
    // uploaded favicon serves on every probe and stale third-party
    // caches refresh on their next visit.
    return [
      { source: '/favicon.ico', destination: '/icon' },
    ];
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
    // Hashed static URLs (nanoid filename on uploads, content-hashed
    // chunks on /_next/static, hashed app-asset names) are immutable.
    // Once the URL exists it never changes content, so we let browsers
    // and Cloudflare keep them for a year. This is the single biggest
    // win against the "icons and banners load slowly on first paint"
    // complaint: repeat visits skip the network entirely, and the CDN
    // serves first-time visitors from a nearby edge.
    const IMMUTABLE_YEAR = [
      { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
      { key: 'CDN-Cache-Control', value: 'public, max-age=31536000, immutable' },
      { key: 'Cloudflare-CDN-Cache-Control', value: 'public, max-age=31536000, immutable' },
    ];
    return [
      {
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      { source: '/uploads/:path*', headers: IMMUTABLE_YEAR },
      { source: '/app-assets/:path*', headers: IMMUTABLE_YEAR },
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
