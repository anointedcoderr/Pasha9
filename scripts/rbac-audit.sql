-- Built by Anointed Coder.
-- Read-only pre/post-deploy check for the staff permission redesign.
--
-- 1. Lists every per-staff extra permission grant (UserPermission rows) with
--    the holder's username and role, so we can see at a glance whether
--    anyone is relying on a permission code that a route's enforcement was
--    just changed away from (e.g. activity.read, affiliate.read, users.read
--    used for pages that now check reports.read / referrals.read /
--    referrals.write / security.read / security.write / transactions.read /
--    payments.read / support.read instead). If this returns few or no rows,
--    there is nothing to re-grant after deploy.
-- 2. Flags any account that is NOT super_admin but already holds the
--    staff.manage permission via an individual grant, so we know the new
--    "only super_admin can grant staff.manage" lock has nothing pre-existing
--    to reconcile.

\pset pager off

SELECT u.username, r.key AS role, p.key AS permission_key, p.label, up."grantedAt"
FROM "UserPermission" up
JOIN "User" u ON u.id = up."userId"
JOIN "Role" r ON r.id = u."roleId"
JOIN "Permission" p ON p.id = up."permissionId"
ORDER BY u.username, p.key;

SELECT u.username, r.key AS role
FROM "UserPermission" up
JOIN "User" u ON u.id = up."userId"
JOIN "Role" r ON r.id = u."roleId"
JOIN "Permission" p ON p.id = up."permissionId"
WHERE p.key = 'staff.manage' AND r.key <> 'super_admin';
