// Built by Anointed Coder.
//
// Section-based permission picker for the staff console. Renders the raw
// permission catalog grouped into friendly sidebar-section cards, each with a
// "Full access" select-all and plain action labels (View / Approve / Manage)
// instead of technical codes like deposits.review. The underlying permission
// ids are unchanged, so what it submits is exactly what the RBAC enforces; the
// raw code is still available on hover for anyone who wants it.

'use client';

import { useEffect, useMemo, useRef } from 'react';
import { groupPermissionsBySection, type PermissionLike } from '@/lib/auth/permission-sections';

export interface PermissionPickerProps {
  permissions: PermissionLike[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}

export function PermissionPicker({ permissions, selected, onChange }: PermissionPickerProps) {
  const sections = useMemo(() => groupPermissionsBySection(permissions), [permissions]);

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

  if (sections.length === 0) {
    return <p className="text-xs text-ink-lo">No permissions available to grant.</p>;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {sections.map((sec) => {
        const ids = sec.actions.map((a) => a.id);
        const selCount = ids.filter((id) => selected.has(id)).length;
        const allOn = ids.length > 0 && selCount === ids.length;
        return (
          <div key={sec.section} className="rounded-xl border border-neon/10 bg-base-deep/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink-hi">{sec.section}</p>
              <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-ink-mid">
                <SectionAllCheckbox checked={allOn} indeterminate={selCount > 0 && !allOn} onChange={() => setSectionAll(ids, !allOn)} />
                Full access
              </label>
            </div>
            <div className="mt-2 space-y-1.5">
              {sec.actions.map((a) => (
                <label key={a.id} title={a.key} className="flex cursor-pointer items-center gap-2 text-xs text-ink-mid">
                  <input type="checkbox" className="mt-px" checked={selected.has(a.id)} onChange={() => toggleOne(a.id)} />
                  <span className="text-ink-hi">{a.actionLabel}</span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-ink-lo">{selCount} of {ids.length} selected</p>
          </div>
        );
      })}
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
