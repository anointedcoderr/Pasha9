// Built by Anointed Coder.
//
// Section-based permission picker for the staff console, built on the
// unified admin section registry (lib/auth/admin-sections.ts). Renders
// every admin sidebar section under its business group, with a
// "Full access" select-all and plain action labels (View / Edit / Approve /
// Delete / Full access) instead of technical codes like deposits.review.
// The underlying permission ids are unchanged, so what it submits is
// exactly what the RBAC enforces; the raw code is still available on
// hover for anyone who wants it.
//
// The Staff & Sub-admins section is locked to Super Admin: a non-super
// viewer sees it greyed out with an explanation rather than being able to
// grant staff-management rights they do not hold themselves. This mirrors
// the server-side check in POST/PATCH /api/admin/staff, which only lets a
// super_admin add or remove the staff.manage grant.

'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Lock } from 'lucide-react';
import { ADMIN_SECTIONS, sectionPermissions } from '@/lib/auth/admin-sections';
import type { PermissionLike } from '@/lib/auth/permission-sections';

export interface PermissionPickerProps {
  permissions: PermissionLike[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  /** The signed-in viewer's own role, used to lock the Staff section. */
  viewerRole: string;
}

export function PermissionPicker({ permissions, selected, onChange, viewerRole }: PermissionPickerProps) {
  const keyToId = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of permissions) m.set(p.key, p.id);
    return m;
  }, [permissions]);

  // Sections that have at least one grantable action AND resolve to a real
  // permission id in the loaded catalog, grouped by business group in
  // registry order.
  const groups = useMemo(() => {
    const bySection = ADMIN_SECTIONS
      .filter((s) => s.actions.length > 0)
      .map((s) => ({
        section: s,
        ids: sectionPermissions(s).map((k) => keyToId.get(k)).filter((id): id is string => !!id),
        actionsById: s.actions
          .map((a) => ({ ...a, id: keyToId.get(a.permission) }))
          .filter((a): a is typeof a & { id: string } => !!a.id),
      }))
      .filter((s) => s.ids.length > 0);

    const byGroup = new Map<string, typeof bySection>();
    for (const entry of bySection) {
      const arr = byGroup.get(entry.section.group) ?? [];
      arr.push(entry);
      byGroup.set(entry.section.group, arr);
    }
    return Array.from(byGroup.entries());
  }, [keyToId]);

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  const setSectionAll = (ids: string[], on: boolean) => {
    const next = new Set(selected);
    for (const id of ids) {
      if (on) next.add(id);
      else next.delete(id);
    }
    onChange(next);
  };

  if (groups.length === 0) {
    return <p className="text-xs text-ink-lo">No permissions available to grant.</p>;
  }

  return (
    <div className="space-y-5">
      {groups.map(([group, sections]) => (
        <div key={group}>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-gold-300">{group}</p>
          <div className="grid gap-3 md:grid-cols-2">
            {sections.map(({ section, ids, actionsById }) => {
              const locked = !!section.superAdminOnly && viewerRole !== 'super_admin';
              const selCount = ids.filter((id) => selected.has(id)).length;
              const allOn = ids.length > 0 && selCount === ids.length;
              return (
                <div
                  key={section.key}
                  className={locked ? 'rounded-xl border border-neon/10 bg-base-deep/20 p-3 opacity-60' : 'rounded-xl border border-neon/10 bg-base-deep/40 p-3'}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-hi">
                      {section.label}
                      {section.superAdminOnly ? <Lock className="h-3 w-3 text-ink-lo" /> : null}
                    </p>
                    {locked ? (
                      <span className="text-[10px] font-medium text-ink-lo">Super Admin only</span>
                    ) : (
                      <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-ink-mid">
                        <SectionAllCheckbox checked={allOn} indeterminate={selCount > 0 && !allOn} onChange={() => setSectionAll(ids, !allOn)} />
                        Full access
                      </label>
                    )}
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {actionsById.map((a) => (
                      <label
                        key={a.id}
                        title={a.permission}
                        className={locked ? 'flex items-center gap-2 text-xs text-ink-lo' : 'flex cursor-pointer items-center gap-2 text-xs text-ink-mid'}
                      >
                        <input
                          type="checkbox"
                          className="mt-px"
                          disabled={locked}
                          checked={selected.has(a.id)}
                          onChange={() => toggleOne(a.id)}
                        />
                        <span className={locked ? '' : 'text-ink-hi'}>{a.label}</span>
                      </label>
                    ))}
                  </div>
                  {locked ? (
                    <p className="mt-2 text-[10px] text-ink-lo">Only a Super Admin can grant Staff &amp; Sub-admin access.</p>
                  ) : (
                    <p className="mt-2 text-[10px] text-ink-lo">{selCount} of {ids.length} selected</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// A checkbox that shows the indeterminate (partial) state when some but not all
// actions in the section are selected. React has no indeterminate prop, so we
// set it imperatively on the DOM node.
function SectionAllCheckbox({ checked, indeterminate, onChange }: { checked: boolean; indeterminate: boolean; onChange: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return <input ref={ref} type="checkbox" checked={checked} onChange={onChange} />;
}
