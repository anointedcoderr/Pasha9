// Built by Anointed Coder.
//
// Read-only role + permission snapshot for the M1 Staff page. Lists
// every Role, its key, label, and the set of Permission rows attached
// via the RolePermission join table.

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { withAuth, ensureAdmin } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';

export async function GET() {
  return withAuth(async () => {
    await ensureAdmin();
    const roles = await db.role.findMany({
      orderBy: { key: 'asc' },
      include: {
        permissions: {
          include: { permission: true },
          orderBy: { permission: { key: 'asc' } },
        },
      },
    });
    return jsonOk({
      roles: roles.map((r) => ({
        key: r.key,
        label: r.label,
        permissions: r.permissions.map((rp) => ({
          key: rp.permission.key,
          label: rp.permission.label,
          group: rp.permission.group,
        })),
      })),
    });
  });
}
