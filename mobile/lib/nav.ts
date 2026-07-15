// Built by Anointed Coder.
//
// Safe internal-route resolver. Banners, promo cards, game rows and homepage
// sections carry admin-entered link paths shared with the website. A web path
// like /live-casino or /dashboard/wallet has no screen on mobile and would
// dead-end on the expo-router "Unmatched Route" page. This maps the known
// web paths to their app routes, passes through any path that matches a real
// app route, and falls back to a safe default for anything unknown, so an
// operator link never strands the player.

// Web paths that differ from the app route for the same destination.
const WEB_TO_APP: Record<string, string> = {
  '/dashboard/wallet': '/wallet',
  '/dashboard': '/wallet',
  '/support': '/legal/support',
  '/home': '/',
};

// Route prefixes that resolve to a real screen in mobile/app.
const KNOWN_PREFIXES = [
  '/wallet', '/deposit', '/withdraw', '/transactions',
  '/games', '/sports',
  '/promotions', '/referral', '/lotto', '/betting-pass', '/rewards', '/affiliate', '/vip',
  '/profile', '/edit-profile', '/change-password', '/notifications', '/leaderboard',
  '/legal', '/auth',
];

/**
 * Resolve an admin-entered internal href to a safe in-app route. Only for
 * paths that start with "/" (external http links are opened separately via
 * the in-app browser). Returns the fallback for anything that is not a real
 * app route so navigation never lands on Unmatched Route.
 */
export function resolveHref(href: string | null | undefined, fallback = '/games'): string {
  if (!href || typeof href !== 'string') return fallback;
  const trimmed = href.trim();
  if (!trimmed.startsWith('/')) return fallback;

  const path = trimmed.split('?')[0].replace(/\/+$/, '') || '/';
  const query = trimmed.slice(path.length);

  const mapped = WEB_TO_APP[path];
  if (mapped) return mapped + query;

  if (path === '/') return '/';
  if (KNOWN_PREFIXES.some((p) => path === p || path.startsWith(p + '/'))) return trimmed;

  return fallback;
}

/** True when a link should open in the in-app browser rather than route in-app. */
export function isExternalHref(href: string | null | undefined): boolean {
  return typeof href === 'string' && /^https?:\/\//i.test(href.trim());
}
