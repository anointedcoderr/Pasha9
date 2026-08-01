// Built by Anointed Coder.
//
// M2G staff per-row update. PATCH accepts any subset of:
//   roleKey               change the base role
//   status                active | blocked | pending (suspend / reactivate)
//   blockedReason         free text shown on the staff blocked banner
//   password              admin password reset (NEW hash, never logged)
//   extraPermissionIds    REPLACE the user's per-staff permission grants
//                         (pass [] to clear, omit to leave untouched)
//
// On any privilege-changing action we revoke prior sessions so the
// new RBAC takes effect immediately, not 8 hours later when the
// access cookie expires.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { hashPassword } from '@/lib/auth/password';
import { revokePriorSessionsForUser } from '@/lib/auth/session';

const STAFF_ROLE_KEYS = ['super_admin', 'admin', 'staff'] as const;

const patchSchema = z.object({
  roleKey: z.enum(STAFF_ROLE_KEYS as unknown as [string, ...string[]]).optional(),
  status: z.enum(['active', 'blocked', 'pending']).optional(),
  blockedReason: z.string().max(240).optional().nullable(),
  password: z.string().min(8).max(128).optional(),
  extraPermissionIds: z.array(z.string()).optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('staff.manage');

    const target = await db.user.findUnique({
      where: { id: params.id },
      include: { role: true },
    });
    if (!target) return jsonError(404, 'NOT_FOUND');
    if (!(STAFF_ROLE_KEYS as readonly string[]).includes(target.role.key)) {
      return jsonError(400, 'NOT_A_STAFF', 'Target user is not a staff member. Use /admin/users instead.');
    }

    // Locked: no self-demotion or self-suspension (operator could
    // accidentally lock themselves out).
    if (target.id === session.sub) {
      return jsonError(403, 'SELF_EDIT_FORBIDDEN', 'You cannot edit your own staff account from this screen.');
    }
    // Only super_admin can edit another super_admin OR change anyone
    // to/from super_admin / admin.
    if (target.role.key === 'super_admin' && session.role !== 'super_admin') {
      return jsonError(403, 'ROLE_NOT_ALLOWED', 'Only super_admin can modify a super_admin account.');
    }

    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const data = parsed.data;

    if (data.roleKey && (data.roleKey === 'super_admin' || data.roleKey === 'admin') && session.role !== 'super_admin') {
      return jsonError(403, 'ROLE_NOT_ALLOWED', 'Only super_admin can promote to super_admin or admin.');
    }

    let newRoleId: string | undefined;
    if (data.roleKey && data.roleKey !== target.role.key) {
      const role = await db.role.findUnique({ where: { key: data.roleKey } });
      if (!role) return jsonError(400, 'ROLE_NOT_FOUND', `Role ${data.roleKey} is not seeded.`);
      newRoleId = role.id;
    }

    // Validate any per-staff permission grants before we touch the DB.
    let extraIds: string[] | undefined;
    if (data.extraPermissionIds !== undefined) {
      extraIds = Array.from(new Set(data.extraPermissionIds));
      if (extraIds.length > 0) {
        const found = await db.permission.findMany({ where: { id: { in: extraIds } }, select: { id: true, key: true } });
        if (found.length !== extraIds.length) {
          return jsonError(400, 'PERMISSION_NOT_FOUND', 'One or more permission ids do not exist.');
        }
        // Lock down: only super_admin can hand out (or preserve, in a set
        // they are resubmitting) staff.manage itself. Matches the same rule
        // enforced on staff creation - see POST /api/admin/staff.
        if (found.some((p) => p.key === 'staff.manage') && session.role !== 'super_admin') {
          return jsonError(403, 'ROLE_NOT_ALLOWED', 'Only super_admin can grant Staff & Sub-admin management access.');
        }
      }
    }

    const newPasswordHash = data.password ? await hashPassword(data.password) : undefined;
    const willChangeStatus = data.status !== undefined && data.status !== target.status;

    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: target.id },
        data: {
          ...(newRoleId ? { roleId: newRoleId } : {}),
          ...(data.status !== undefined ? { status: data.status } : {}),
          ...(data.status === 'blocked'
            ? { blockedAt: new Date(), blockedReason: data.blockedReason ?? null }
            : {}),
          ...(data.status && data.status !== 'blocked' ? { blockedAt: null, blockedReason: null } : {}),
          ...(newPasswordHash ? { passwordHash: newPasswordHash, passwordChangedAt: new Date() } : {}),
        },
      });

      if (extraIds !== undefined) {
        await tx.userPermission.deleteMany({ where: { userId: target.id } });
        if (extraIds.length > 0) {
          await tx.userPermission.createMany({
            data: extraIds.map((permissionId) => ({
              userId: target.id,
              permissionId,
              grantedById: session.sub,
            })),
          });
        }
      }
    });

    // Privilege-changing actions: kill active sessions so the staff
    // member must re-login with the new RBAC. Suspending also kills
    // sessions immediately.
    if (newRoleId || extraIds !== undefined || newPasswordHash || data.status === 'blocked') {
      await revokePriorSessionsForUser(target.id);
    }

    const changes: string[] = [];
    if (newRoleId) changes.push(`role=${data.roleKey}`);
    if (willChangeStatus) changes.push(`status=${data.status}`);
    if (newPasswordHash) changes.push('password=reset');
    if (extraIds !== undefined) changes.push(`extra_perms=${extraIds.length}`);

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: data.status === 'blocked' ? 'STAFF_SUSPEND' : data.status === 'active' ? 'STAFF_REACTIVATE' : 'STAFF_UPDATE',
      target: target.id,
      detail: changes.length > 0 ? changes.join(' . ') : 'no-op',
      meta: { changes, ...(data.blockedReason ? { blockedReason: data.blockedReason } : {}) },
    });

    return jsonOk({ ok: true, changes });
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('staff.manage');
    const target = await db.user.findUnique({
      where: { id: params.id },
      include: { role: true },
    });
    if (!target) return jsonError(404, 'NOT_FOUND');
    if (!(STAFF_ROLE_KEYS as readonly string[]).includes(target.role.key)) {
      return jsonError(400, 'NOT_A_STAFF');
    }
    if (target.id === session.sub) return jsonError(403, 'SELF_EDIT_FORBIDDEN');
    if (target.role.key === 'super_admin' && session.role !== 'super_admin') {
      return jsonError(403, 'ROLE_NOT_ALLOWED');
    }
    // Hard delete is dangerous (cascades into wallet, transactions,
    // activity logs - which we want to KEEP for audit). Instead, flip
    // status to blocked + nuke sessions. Use rename safeguard so the
    // username can be reused later.
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: target.id },
        data: {
          status: 'blocked',
          blockedAt: new Date(),
          blockedReason: 'staff_deleted_by_admin',
          username: `${target.username}.deleted.${Date.now()}`,
        },
      });
      await tx.userPermission.deleteMany({ where: { userId: target.id } });
    });
    await revokePriorSessionsForUser(target.id);
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'STAFF_DELETE',
      target: target.id,
      detail: `was ${target.username}, demoted to blocked`,
    });
    return jsonOk({ ok: true });
  });
}
