// Built by Anointed Coder.
// Shared route-handler guards. Returns a NextResponse when access is denied.

import { NextResponse } from 'next/server';
import { AuthError, requireAdmin, requirePermission, requireStaff, requireSuperAdmin, requireUser, requireActiveUser } from './rbac';
import { jsonError } from './errors';
import { db } from '@/lib/db/client';
import { getClientIp, getUserAgent } from './session';
import { isIpBlockedCached, isIpBlocked } from '@/lib/security/ip-block';

export async function withAuth<T>(handler: () => Promise<T>) {
  // M2K: cheap up-front IP block check using the cached snapshot.
  // The cache is warmed by the first DB lookup; until then we let
  // requests through (the cold-start window). If the snapshot says
  // blocked, return 403 without touching the handler. If it says
  // not-blocked, the route handler proceeds normally - any
  // login-route does its own fresh isIpBlocked check as a backup.
  try {
    const ip = getClientIp();
    const cached = isIpBlockedCached(ip);
    if (cached.blocked) {
      return jsonError(403, 'IP_BLOCKED', `Access denied. IP ${ip} is on the block list.`);
    }
    // Warm the cache lazily so the next request has a synchronous
    // answer. Errors swallowed - never break auth on a logging fault.
    void isIpBlocked(ip).catch(() => undefined);
  } catch { /* never let the IP check break auth */ }

  try {
    return await handler();
  } catch (err) {
    if (err instanceof AuthError) {
      const status = err.code === 'UNAUTHENTICATED' ? 401 : 403;
      return jsonError(status, err.code, err.message);
    }
    console.error(err);
    return jsonError(500, 'SERVER_ERROR');
  }
}

export async function ensureUser() { return requireUser(); }
export async function ensureActiveUser() { return requireActiveUser(); }
export async function ensureStaff() { return requireStaff(); }
export async function ensureAdmin() { return requireAdmin(); }
export async function ensureSuperAdmin() { return requireSuperAdmin(); }
export async function ensurePermission(perm: string) { return requirePermission(perm); }

export async function recordActivity(opts: {
  actorId: string;
  actorRole: string;
  action: string;
  target?: string;
  detail?: string;
  meta?: Record<string, unknown>;
}) {
  try {
    await db.activityLog.create({
      data: {
        actorId: opts.actorId,
        actorRole: opts.actorRole,
        action: opts.action,
        target: opts.target,
        detail: opts.detail,
        meta: opts.meta as never,
        ip: getClientIp(),
        userAgent: getUserAgent(),
      },
    });
  } catch (err) {
    console.error('activity log failed', err);
  }
}

export { NextResponse };
