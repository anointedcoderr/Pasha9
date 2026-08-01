// Built by Anointed Coder.
//
// M2G staff CRUD. GET lists every user whose role is super_admin /
// admin / staff with their role + per-user permission overrides.
// POST creates a new staff account. Permission gate: staff.manage
// (or super_admin bypass via the rbac default).
//
// Notes:
//   - Username + phone uniqueness is enforced by the schema; we
//     pre-check to return a clean DUPLICATE error code instead of
//     a generic Prisma error.
//   - A bcrypt password hash is generated via the same helper the
//     public register flow uses. The cleartext password is NEVER
//     stored or logged - only the bcrypt digest goes to the DB.
//   - A unique referralCode is generated even for staff (they still
//     count as users in the schema; we never use it for staff).

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { hashPassword } from '@/lib/auth/password';
import { generateUniqueReferralCode } from '@/lib/auth/referral';

const STAFF_ROLE_KEYS = ['super_admin', 'admin', 'staff'] as const;

const createSchema = z.object({
  username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9_.-]+$/, 'Letters, digits, dot, dash, underscore only'),
  phone: z.string().trim().min(6).max(20),
  email: z.string().trim().email().optional().nullable(),
  password: z.string().min(8).max(128),
  roleKey: z.enum(STAFF_ROLE_KEYS as unknown as [string, ...string[]]),
  extraPermissionIds: z.array(z.string()).optional().default([]),
  status: z.enum(['active', 'pending', 'blocked']).optional().default('active'),
});

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    await ensurePermission('staff.manage');
    const url = new URL(req.url);
    const q = url.searchParams.get('q')?.trim().toLowerCase() ?? '';

    const where: { role: { key: { in: string[] } }; OR?: object[] } = {
      role: { key: { in: STAFF_ROLE_KEYS as unknown as string[] } },
    };
    if (q) {
      where.OR = [
        { username: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }

    const rows = await db.user.findMany({
      where,
      orderBy: [{ role: { key: 'asc' } }, { username: 'asc' }],
      include: {
        role: true,
        extraPermissions: { include: { permission: true } },
      },
      take: 200,
    });

    return jsonOk({
      staff: rows.map((u) => ({
        id: u.id,
        username: u.username,
        phone: u.phone,
        email: u.email,
        role: { id: u.role.id, key: u.role.key, label: u.role.label },
        status: u.status,
        blockedReason: u.blockedReason,
        blockedAt: u.blockedAt,
        lastLoginAt: u.lastLoginAt,
        lastLoginIp: u.lastLoginIp,
        createdAt: u.createdAt,
        extraPermissions: u.extraPermissions.map((ep) => ({
          id: ep.permissionId,
          key: ep.permission.key,
          label: ep.permission.label,
          group: ep.permission.group,
          grantedAt: ep.grantedAt,
        })),
      })),
    });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('staff.manage');
    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const data = parsed.data;

    // Lock down: only super_admin can mint another super_admin or
    // admin. Staff.manage holders without super_admin can mint up to
    // role=staff.
    if ((data.roleKey === 'super_admin' || data.roleKey === 'admin') && session.role !== 'super_admin') {
      return jsonError(403, 'ROLE_NOT_ALLOWED', 'Only super_admin can create super_admin or admin accounts.');
    }

    const role = await db.role.findUnique({ where: { key: data.roleKey } });
    if (!role) return jsonError(400, 'ROLE_NOT_FOUND', `Role ${data.roleKey} is not seeded.`);

    const dupUsername = await db.user.findUnique({ where: { username: data.username }, select: { id: true } });
    if (dupUsername) return jsonError(409, 'DUPLICATE_USERNAME', 'Username is already taken.');
    const dupPhone = await db.user.findUnique({ where: { phone: data.phone }, select: { id: true } });
    if (dupPhone) return jsonError(409, 'DUPLICATE_PHONE', 'Phone number is already in use.');
    if (data.email) {
      const dupEmail = await db.user.findUnique({ where: { email: data.email }, select: { id: true } });
      if (dupEmail) return jsonError(409, 'DUPLICATE_EMAIL', 'Email is already in use.');
    }

    // Validate any per-staff permission grants before we create.
    const extraIds = Array.from(new Set(data.extraPermissionIds));
    if (extraIds.length > 0) {
      const found = await db.permission.findMany({ where: { id: { in: extraIds } }, select: { id: true, key: true } });
      if (found.length !== extraIds.length) {
        return jsonError(400, 'PERMISSION_NOT_FOUND', 'One or more permission ids do not exist.');
      }
      // Lock down: only super_admin can hand out staff.manage itself. Without
      // this, any staff.manage holder (e.g. the 'admin' role, or a staff
      // member explicitly granted it) could grant staff.manage to someone
      // else, escalating their own reach beyond what a Super Admin approved.
      if (found.some((p) => p.key === 'staff.manage') && session.role !== 'super_admin') {
        return jsonError(403, 'ROLE_NOT_ALLOWED', 'Only super_admin can grant Staff & Sub-admin management access.');
      }
    }

    const passwordHash = await hashPassword(data.password);
    const referralCode = await generateUniqueReferralCode();

    const created = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username: data.username,
          phone: data.phone,
          email: data.email ?? null,
          passwordHash,
          referralCode,
          roleId: role.id,
          status: data.status,
        },
      });
      if (extraIds.length > 0) {
        await tx.userPermission.createMany({
          data: extraIds.map((permissionId) => ({
            userId: user.id,
            permissionId,
            grantedById: session.sub,
          })),
        });
      }
      return user;
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'STAFF_CREATE',
      target: created.id,
      detail: `${data.username} as ${data.roleKey}${extraIds.length > 0 ? ` + ${extraIds.length} extra perm(s)` : ''}`,
      meta: { roleKey: data.roleKey, extraPermissionIds: extraIds, status: data.status },
    });

    return jsonOk({
      ok: true,
      staff: {
        id: created.id,
        username: created.username,
        phone: created.phone,
        email: created.email,
        roleKey: role.key,
        status: created.status,
      },
    }, 201);
  });
}
