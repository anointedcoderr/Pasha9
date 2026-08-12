// Built by Anointed Coder.
// Edge middleware. Verifies the access JWT for protected sections so unauthenticated
// users are bounced before any server component runs.
//
// Staff permission gate: beyond the role check, a signed-in staff/admin
// visitor is also checked against the unified admin section registry
// (lib/auth/admin-sections.ts) using the `perms` claim already carried on
// the access JWT. This is the SERVER-SIDE half of the permission system -
// it runs before any page bytes are sent, so a staff member cannot reach an
// unauthorized admin page by typing or bookmarking its URL directly, even
// with JavaScript disabled. The client-side gate in admin/layout.tsx stays
// as a second layer for instant reaction inside an already-open tab.
//
// The `perms` claim cannot go stale in a way that under-blocks: any
// permission grant or revoke (POST/PATCH /api/admin/staff) calls
// revokePriorSessionsForUser, which forces the affected staff member to log
// in again before the new access token (with the new perms) is issued.

import { NextResponse, type NextRequest } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/jwt';
import { sectionForPath, canViewSection } from '@/lib/auth/admin-sections';

const ADMIN_ROLES = new Set(['super_admin', 'admin', 'staff']);
const ACCESS_COOKIE = 'pasha9_session';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const token = req.cookies.get(ACCESS_COOKIE)?.value;
    const claims = token ? await verifyAccessToken(token) : null;
    if (!claims || !ADMIN_ROLES.has(claims.role)) {
      const url = req.nextUrl.clone();
      url.pathname = '/admin/login';
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }

    // Must come before the section check, not rely on omission from
    // ADMIN_SECTIONS. sectionForPath does PREFIX matching: '/admin/no-access'
    // starts with the overview section's own route ('/admin'), and since no
    // more specific registered route claims it, sectionForPath returns the
    // OVERVIEW section for it, not undefined. That silently re-applies
    // menu.overview.view to the very page meant to be reachable by everyone,
    // so a role missing that permission got denied on /admin/no-access too,
    // redirected to /admin/no-access again, forever - the identical loop
    // this route exists to prevent, just relocated onto itself. This exact
    // guard existed once already and was removed as believed-dead code; it
    // was the fix, not dead code, which is how this got back in.
    if (pathname === '/admin/no-access') return NextResponse.next();

    const section = sectionForPath(pathname);
    if (section && !canViewSection(section, claims.role, claims.perms ?? [])) {
      const url = req.nextUrl.clone();
      url.pathname = '/admin/no-access';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  if (pathname.startsWith('/dashboard')) {
    const token = req.cookies.get(ACCESS_COOKIE)?.value;
    const claims = token ? await verifyAccessToken(token) : null;
    if (!claims) {
      const url = req.nextUrl.clone();
      url.pathname = '/';
      url.searchParams.set('login', '1');
      url.searchParams.set('next', pathname);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/dashboard/:path*'],
};
