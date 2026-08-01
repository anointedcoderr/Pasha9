// Built by Anointed Coder.
//
// Compatibility shim over the unified admin section registry
// (lib/auth/admin-sections.ts), which is now the single source of truth for
// admin permission -> menu / route mapping. This file keeps the original
// function names and signatures (canAccessAdminMenuItem, canAccessAdminPath,
// permissionForAdminPath) so AdminSidebar, AdminMobileDrawer and the admin
// shell layout need no changes; each just delegates to the registry.
//
// Where this is used:
//   1. AdminSidebar + AdminMobileDrawer filtering (UI hides items the
//      visitor cannot reach)
//   2. The admin shell layout's client-side pathname gate (instant reaction
//      to a permission change without a full navigation)
//   3. middleware.ts additionally enforces the SAME rule server-side, at
//      the edge, before any page bytes are sent - this is what actually
//      blocks a staff member from reaching an unauthorized page by typing
//      or bookmarking its URL directly.
//
// Super admins bypass every check (see canViewSection). API routes enforce
// their own ensurePermission() call independently; this map exists so a
// staff visitor never SEES a page they cannot use, and now also cannot
// reach it directly.

import { ADMIN_SECTIONS, sectionForPath, sectionForMenuKey, canViewSection } from './admin-sections';

/**
 * Returns the permission key required to view the given admin path, or null
 * when the path is open to any signed-in admin/staff (the dashboard, the
 * account page). When a section has more than one gating permission
 * (rare), the first is returned; callers that need the full set should use
 * canAccessAdminPath / canViewSection directly instead.
 */
export function permissionForAdminPath(pathname: string): string | null {
  const section = sectionForPath(pathname);
  if (!section || section.alwaysAllow) return null;
  const codes = section.actions.map((a) => a.permission);
  return codes[0] ?? null;
}

export function canAccessAdminPath(pathname: string, role: string, perms: string[]): boolean {
  const section = sectionForPath(pathname);
  if (!section) return true; // unmapped path: open to any signed-in staff
  return canViewSection(section, role, perms);
}

export function canAccessAdminMenuItem(key: string, role: string, perms: string[]): boolean {
  const section = sectionForMenuKey(key);
  if (!section) return true; // unmapped menu key: open to any signed-in staff
  return canViewSection(section, role, perms);
}

// Re-exported for anything that still wants the raw registry.
export { ADMIN_SECTIONS };
