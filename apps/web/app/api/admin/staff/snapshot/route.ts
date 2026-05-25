// Built by Anointed Coder.
//
// Role + permission snapshot. Returns:
//   - roles[]       every Role (key, label, permissions)
//   - permissions[] master catalog grouped by Permission.group, used
//                   by the M2G /admin/staff drawer to render the
//                   per-staff permission override checkboxes

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { withAuth, ensureAdmin } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';

export async function GET() {
  return withAuth(async () => {
    await ensureAdmin();
    const [roles, permissions] = await Promise.all([
      db.role.findMany({
        orderBy: { key: 'asc' },
        include: {
          permissions: {
            include: { permission: true },
            orderBy: { permission: { key: 'asc' } },
          },
        },
      }),
      db.permission.findMany({
        orderBy: [{ group: 'asc' }, { key: 'asc' }],
      }),
    ]);

    return jsonOk({
      roles: roles.map((r) => ({
        id: r.id,
        key: r.key,
        label: r.label,
        permissions: r.permissions.map((rp) => ({
          id: rp.permission.id,
          key: rp.permission.key,
          label: rp.permission.label,
          group: rp.permission.group,
        })),
      })),
      permissions: permissions.map((p) => ({
        id: p.id,
        key: p.key,
        label: p.label,
        group: p.group,
      })),
    });
  });
}
