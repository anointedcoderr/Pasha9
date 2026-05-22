// Built by Anointed Coder.
// Role-based access control helpers. Used inside route handlers and server components.

import { db } from '@/lib/db/client';
import { getSessionClaims } from './session';
import type { AccessClaims } from './jwt';

const STAFF_ROLES = new Set(['super_admin', 'admin', 'staff']);
const ADMIN_ROLES = new Set(['super_admin', 'admin']);

export class AuthError extends Error {
  constructor(public code: 'UNAUTHENTICATED' | 'FORBIDDEN', message?: string) {
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

  // Fall back to DB check if the claim is missing the perms array.
  const user = await db.user.findUnique({
    where: { id: s.sub },
    select: { role: { include: { permissions: { include: { permission: true } } } } },
  });
  const keys = user?.role.permissions.map((rp) => rp.permission.key) ?? [];
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
