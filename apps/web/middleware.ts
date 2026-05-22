// Built by Anointed Coder.
// Edge middleware. Verifies the access JWT for protected sections so unauthenticated
// users are bounced before any server component runs.

import { NextResponse, type NextRequest } from 'next/server';
import { verifyAccessToken } from '@/lib/auth/jwt';

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
