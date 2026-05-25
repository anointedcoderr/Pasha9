// Built by Anointed Coder.
// Role-based access control helpers. Used inside route handlers and server components.

import { db } from '@/lib/db/client';
import { getSessionClaims } from './session';
import type { AccessClaims } from './jwt';

const STAFF_ROLES = new Set(['super_admin', 'admin', 'staff']);
const ADMIN_ROLES = new Set(['super_admin', 'admin']);

export class AuthError extends Error {
  constructor(public code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'USER_BLOCKED', message?: string) {
    super(message ?? code);
  }
}

export async function getCurrentSession(): Promise<AccessClaims | null> {
  return getSessionClaims();
}

export async function requireUser(): Promise<AccessClaims> {
  const s = await getSessionClaims();
  if (!s) throw new AuthError('UNAUTHENTICATED');
  return s;
}

/**
 * Same as requireUser() but also rejects blocked users with
 * USER_BLOCKED (403). Use on every protected POST that mutates wallet
 * / lotto / affiliate / profile state. One extra small DB roundtrip
 * per call, which is fine at the low write rates these endpoints see.
 */
export async function requireActiveUser(): Promise<AccessClaims> {
  const s = await requireUser();
  const user = await db.user.findUnique({
    where: { id: s.sub },
    select: { status: true },
  });
  if (!user) throw new AuthError('UNAUTHENTICATED');
  if (user.status === 'blocked') throw new AuthError('USER_BLOCKED', 'Your account is suspended.');
  return s;
}

export async function requireRole(...allowed: string[]): Promise<AccessClaims> {
  const s = await requireUser();
  if (!allowed.includes(s.role)) throw new AuthError('FORBIDDEN');
  return s;
}

export async function requireStaff(): Promise<AccessClaims> {
  const s = await requireUser();
  if (!STAFF_ROLES.has(s.role)) throw new AuthError('FORBIDDEN');
  return s;
}

export async function requireAdmin(): Promise<AccessClaims> {
  const s = await requireUser();
  if (!ADMIN_ROLES.has(s.role)) throw new AuthError('FORBIDDEN');
  return s;
}

export async function requireSuperAdmin(): Promise<AccessClaims> {
  const s = await requireUser();
  if (s.role !== 'super_admin') throw new AuthError('FORBIDDEN');
  return s;
}

export async function requirePermission(permission: string): Promise<AccessClaims> {
  const s = await requireUser();
  if (s.role === 'super_admin') return s;
  if (s.perms?.includes(permission)) return s;

  // Fall back to DB check if the claim is missing the perms array
  // OR if an admin granted a new permission AFTER this session was
  // minted (so it never made it into the JWT). M2G: also merges in
  // per-user permission overrides from UserPermission.
  const keys = await loadEffectivePermissions(s.sub);
  if (keys.includes(permission)) return s;

  throw new AuthError('FORBIDDEN');
}

export async function loadPermissionsForRole(roleId: string): Promise<string[]> {
  const rows = await db.rolePermission.findMany({
    where: { roleId },
    include: { permission: true },
  });
  return rows.map((r) => r.permission.key);
}

/**
 * M2G: returns the union of role permissions and per-user permission
 * grants for one user, deduped. Use this when computing the JWT
 * `perms` claim at login + refresh, and as the fallback check inside
 * requirePermission. Super admins are not handled here - their bypass
 * lives in requirePermission directly.
 */
export async function loadEffectivePermissions(userId: string): Promise<string[]> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      role: { include: { permissions: { include: { permission: true } } } },
      extraPermissions: { include: { permission: true } },
    },
  });
  if (!user) return [];
  const fromRole = user.role.permissions.map((rp) => rp.permission.key);
  const fromUser = user.extraPermissions.map((up) => up.permission.key);
  return Array.from(new Set([...fromRole, ...fromUser]));
}
