// Built by Anointed Coder.
//
// Staff / Sub-admin management. M1 surfaces the seeded role + permission
// matrix read-only. Creating new staff accounts, suspending or rotating
// permissions through the UI ships in M2 once provider hooks (audit
// alerts + OTP for staff actions) land.

'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Users, Lock, Shield, KeyRound, UserPlus } from 'lucide-react';

interface RoleSnapshot {
  key: string;
  label: string;
  permissions: { key: string; label: string; group: string }[];
}

export default function AdminStaffPage() {
  const [roles, setRoles] = useState<RoleSnapshot[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/staff/snapshot', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.roles) setRoles(data.roles as RoleSnapshot[]);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load roles'));
  }, []);

  return (
    <>
      <PageHeader
        title="Staff & Sub-admins"
        subtitle="Role + permission matrix, read-only in M1"
        icon={<Users className="h-5 w-5" />}
      />

      <Card padding="md" className="mb-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700">
            <Lock className="h-4 w-4" />
          </span>
          <div className="text-sm">
            <p className="font-semibold text-ink-hi">Read-only in Milestone 1</p>
            <p className="mt-0.5 text-xs text-ink-mid">
              The role + permission table below is the live seed used by the auth guard. New staff accounts,
              suspending an existing staff member, rotating per-role permissions and granular per-staff overrides
              are scheduled for Milestone 2 (the schema is already in place via Role + Permission + RolePermission).
            </p>
          </div>
        </div>
      </Card>

      {error ? (
        <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{error}</p></Card>
      ) : null}

      {!roles ? (
        <Card padding="lg">Loading roles...</Card>
      ) : (
        <div className="space-y-4">
          {roles.map((r) => (
            <Card key={r.key} padding="lg">
              <CardHeader
                title={r.label}
                subtitle={`role key: ${r.key} · ${r.permissions.length} permission(s)`}
                action={<Chip tone={r.key === 'super_admin' ? 'ok' : r.key === 'admin' ? 'warn' : 'info'}>{r.key}</Chip>}
              />
              {r.permissions.length === 0 ? (
                <p className="text-sm text-ink-mid">No permissions assigned.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {r.permissions.map((p) => (
                    <span key={p.key} className="inline-flex items-center gap-1 rounded-md border border-neon/15 bg-base-deep/40 px-2 py-0.5 text-[11px] text-ink-mid">
                      <KeyRound className="h-3 w-3 text-gold-300" />
                      <span className="font-mono">{p.key}</span>
                    </span>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Card padding="lg" className="mt-6">
        <CardHeader
          title="Coming in Milestone 2"
          subtitle="Wired-for-M2 surfaces"
          action={<Chip tone="warn">Ready for M2</Chip>}
        />
        <ul className="grid gap-2 sm:grid-cols-2">
          <ScaffoldRow icon={UserPlus} label="Create staff account (super admin only)" />
          <ScaffoldRow icon={Shield} label="Suspend / reactivate staff" />
          <ScaffoldRow icon={KeyRound} label="Override per-staff permission grants" />
          <ScaffoldRow icon={Users} label="Staff activity log (filter by actor)" />
        </ul>
      </Card>
    </>
  );
}

function ScaffoldRow({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-neon/10 bg-base-deep/40 p-3 text-sm text-ink-mid">
      <Icon className="h-4 w-4 text-gold-300" />
      <span>{label}</span>
    </li>
  );
}
