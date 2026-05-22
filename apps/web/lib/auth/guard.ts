// Built by Anointed Coder.
// Shared route-handler guards. Returns a NextResponse when access is denied.

import { NextResponse } from 'next/server';
import { AuthError, requireAdmin, requirePermission, requireStaff, requireSuperAdmin, requireUser } from './rbac';
import { jsonError } from './errors';
import { db } from '@/lib/db/client';
import { getClientIp, getUserAgent } from './session';

export async function withAuth<T>(handler: () => Promise<T>) {
  try {
    return await handler();
  } catch (err) {
    if (err instanceof AuthError) {
      const status = err.code === 'UNAUTHENTICATED' ? 401 : 403;
      return jsonError(status, err.code);
    }
    console.error(err);
    return jsonError(500, 'SERVER_ERROR');
  }
}

export async function ensureUser() { return requireUser(); }
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
