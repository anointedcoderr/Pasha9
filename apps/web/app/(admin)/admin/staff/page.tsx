// Built by Anointed Coder.
//
// M2G admin staff console:
//   - List every super_admin / admin / staff user (search by
//     username / phone / email)
//   - Create new staff (Modal)
//   - Per-staff Drawer to change role, suspend/reactivate, reset
//     password, add or remove extra permission grants beyond the
//     role baseline
//   - Reference cards showing role catalog + permission catalog
//     (read-only, seeded from packages/database/prisma/seed.ts)

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { Modal, Drawer } from '@/components/ui/Modal';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Users, ShieldCheck, Plus, Pencil, Ban, Sparkles, KeyRound, RefreshCw, ListFilter } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { formatBDT } from '@/lib/utils/format';
import { PermissionPicker } from '@/components/admin/PermissionPicker';
import { useAdminPermissions } from '@/lib/auth/use-admin-permissions';
import { ADMIN_SECTIONS, sectionPermissions } from '@/lib/auth/admin-sections';

interface RoleSnapshot {
  id: string;
  key: string;
  label: string;
  permissions: PermissionRef[];
}
interface PermissionRef {
  id: string;
  key: string;
  label: string;
  group: string;
}
interface StaffRow {
  id: string;
  username: string;
  phone: string;
  email: string | null;
  role: { id: string; key: string; label: string };
  status: 'active' | 'blocked' | 'pending';
  blockedReason: string | null;
  blockedAt: string | null;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  createdAt: string;
  extraPermissions: PermissionRef[];
}

const ROLE_KEYS = ['super_admin', 'admin', 'staff'] as const;

function statusTone(s: string): 'ok' | 'warn' | 'danger' | 'neutral' {
  if (s === 'active') return 'ok';
  if (s === 'pending') return 'warn';
  if (s === 'blocked') return 'danger';
  return 'neutral';
}

function roleTone(key: string): 'gold' | 'info' | 'neutral' {
  if (key === 'super_admin') return 'gold';
  if (key === 'admin') return 'info';
  return 'neutral';
}

const STAFF_TURNOVER_KEY = 'staff_balance_turnover_x';

/**
 * The one setting that decides whether a staff-originated balance credit
 * carries an automatic turnover requirement, and by how much. Lives here
 * rather than the general Settings page because this page is already
 * restricted to super_admin at the section level - the client's explicit
 * requirement that only a Super Admin can control this - and because it
 * governs the same staff-credit flow the points panel below is about.
 *
 * Ships at 0 (no requirement) until set: a multiplier that started applying
 * itself on deploy would silently change what every staff credit costs a
 * player, the same reasoning behind every other new financial default
 * shipped tonight.
 */
function StaffBalanceTurnoverSetting() {
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/admin/settings', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        const row = (j?.settings as Array<{ key: string; value: string }> | undefined)?.find((s) => s.key === STAFF_TURNOVER_KEY);
        const n = Math.max(0, Number(row?.value ?? 0) || 0);
        setValue(String(n));
        setSaved(n);
      })
      .catch(() => { if (alive) setError('Could not load the setting.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const n = Math.max(0, Number(value) || 0);
      const r = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ updates: [{ key: STAFF_TURNOVER_KEY, value: String(n) }] }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Save failed');
      setSaved(n);
      setValue(String(n));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card padding="md" className="mb-4">
      <h2 className="mb-1 text-sm font-semibold text-ink-hi">Staff credit turnover multiplier</h2>
      <p className="mb-3 text-xs text-ink-lo">
        Whenever a staff or admin account (not you) credits a player, a turnover requirement is created automatically at
        this multiple of the amount credited. Example: 1,000 credited at 3x creates a 3,000 turnover requirement. 0
        means no requirement is created. Staff cannot set, skip, or edit this.
      </p>
      {loading ? (
        <p className="text-sm text-ink-mid">Loading...</p>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-28">
            <FormField label="Multiplier">
              <Input type="number" min="0" step="0.1" value={value} onChange={(e) => setValue(e.target.value)} />
            </FormField>
          </div>
          <Button size="sm" variant="gold" loading={saving} disabled={Number(value) === saved} onClick={save}>Save</Button>
          {saved !== null ? (
            <span className="text-xs text-ink-lo">
              Currently {saved === 0 ? 'off' : `${saved}x`}
            </span>
          ) : null}
        </div>
      )}
      {error ? <p className="mt-2 text-sm text-signal-danger">{error}</p> : null}
    </Card>
  );
}

export default function AdminStaffPage() {
  const { role: viewerRole } = useAdminPermissions();
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [roles, setRoles] = useState<RoleSnapshot[]>([]);
  const [permissions, setPermissions] = useState<PermissionRef[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [drawerStaff, setDrawerStaff] = useState<StaffRow | null>(null);

  // Single AbortController shared by every loadStaff() invocation
  // (manual Apply button, post-save reloads AND the debounced search
  // effect). Each call aborts the previous in-flight request before
  // starting its own, so a slow stale response can never clobber
  // fresher results.
  const abortRef = useRef<AbortController | null>(null);

  const loadStaff = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const signal = controller.signal;
    setError(null);
    try {
      const url = search.trim()
        ? `/api/admin/staff?q=${encodeURIComponent(search.trim())}`
        : '/api/admin/staff';
      const res = await fetch(url, { cache: 'no-store', signal });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Failed to load');
      setStaff(data.staff as StaffRow[]);
    } catch (e) {
      // Aborted requests are superseded by a newer keystroke; a stale
      // response must never clobber the fresh one (or paint an error).
      if (e instanceof DOMException && e.name === 'AbortError') return;
      setError(e instanceof Error ? e.message : 'Failed to load staff');
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [search]);

  const loadSnapshot = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/staff/snapshot', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) {
        setRoles((data.roles ?? []) as RoleSnapshot[]);
        setPermissions((data.permissions ?? []) as PermissionRef[]);
      }
    } catch { /* ignore */ }
  }, []);

  // Debounced (300ms): typing in the search box does not fire a fetch
  // per keystroke. Cancellation of in-flight requests happens inside
  // loadStaff() itself via abortRef.
  useEffect(() => {
    const timer = setTimeout(() => { void loadStaff(); }, 300);
    return () => clearTimeout(timer);
  }, [loadStaff]);
  useEffect(() => { loadSnapshot(); }, [loadSnapshot]);
  // Abort any in-flight request when the page unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  // Friendly, section-based summary of what each role can reach, built from
  // the same registry the picker and the sidebar use. Replaces the raw
  // "affiliate.write ; games.write ; ..." code dump the client could not
  // read: a role's baseline is shown as section names ("Deposits, User
  // Management, ...") instead of technical permission keys.
  const roleSectionSummaries = useMemo(() => {
    return roles.map((r) => {
      const keys = new Set(r.permissions.map((p) => p.key));
      const sectionLabels = ADMIN_SECTIONS
        .filter((s) => s.actions.length > 0 && sectionPermissions(s).some((k) => keys.has(k)))
        .map((s) => s.label);
      // Any granted key the registry does not (yet) map to a section still
      // needs to be shown, using its seeded plain-English label rather than
      // the raw code, so nothing silently disappears from the summary.
      const mappedKeys = new Set(
        ADMIN_SECTIONS.filter((s) => sectionLabels.includes(s.label)).flatMap((s) => sectionPermissions(s)),
      );
      const unmapped = r.permissions.filter((p) => !mappedKeys.has(p.key)).map((p) => p.label);
      return { role: r, sectionLabels, unmapped };
    });
  }, [roles]);

  const flashToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  };

  return (
    <>
      <PageHeader
        title="Staff Management"
        subtitle="Create staff accounts, change roles, grant per-staff permissions, suspend or reset access"
        icon={<Users className="h-5 w-5" />}
        action={
          <div className="flex gap-2">
            <Link href="/admin/activity"><Button variant="ghost" leftIcon={<ListFilter className="h-3.5 w-3.5" />}>Activity log</Button></Link>
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>New staff</Button>
          </div>
        }
      />

      {toast ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-ok">{toast}</p></Card> : null}
      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{error}</p></Card> : null}

      <StaffBalanceTurnoverSetting />

      <Card padding="md" className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <FormField label="Search">
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="username, phone, email" />
          </FormField>
          <Button leftIcon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => loadStaff()}>Apply</Button>
        </div>
      </Card>

      {loading ? (
        <p className="text-sm text-ink-mid">Loading staff...</p>
      ) : staff.length === 0 ? (
        <Card padding="lg"><p className="text-sm text-ink-mid">No staff match the current filter. Click <b>New staff</b> to create one.</p></Card>
      ) : (
        <Card padding="md" className="mb-6 overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="text-xs uppercase tracking-wider text-ink-lo">
              <tr>
                <th className="px-2 py-2 text-left">User</th>
                <th className="px-2 py-2 text-left">Role</th>
                <th className="px-2 py-2 text-left">Status</th>
                <th className="px-2 py-2 text-left">Extra perms</th>
                <th className="px-2 py-2 text-left">Last login</th>
                <th className="px-2 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => (
                <tr key={s.id} className="border-t border-neon/10 align-top">
                  <td className="px-2 py-2">
                    <p className="font-semibold text-ink-hi">{s.username}</p>
                    <p className="text-xs text-ink-lo">{s.phone}{s.email ? ` . ${s.email}` : ''}</p>
                  </td>
                  <td className="px-2 py-2"><Chip tone={roleTone(s.role.key)}>{s.role.label}</Chip></td>
                  <td className="px-2 py-2">
                    <Chip tone={statusTone(s.status)}>{s.status}</Chip>
                    {s.blockedReason ? <p className="mt-1 text-[10px] text-ink-lo">{s.blockedReason}</p> : null}
                  </td>
                  <td className="px-2 py-2">
                    {s.extraPermissions.length === 0 ? (
                      <span className="text-xs text-ink-lo">none</span>
                    ) : (
                      <span className="text-xs text-ink-mid">{s.extraPermissions.length} granted</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-xs text-ink-lo">
                    {s.lastLoginAt ? new Date(s.lastLoginAt).toLocaleString() : 'never'}
                    {s.lastLoginIp ? <p className="mt-0.5 font-mono">{s.lastLoginIp}</p> : null}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <Button size="sm" variant="ghost" leftIcon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setDrawerStaff(s)}>Edit</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Card padding="lg" className="mb-6">
        <CardHeader
          title="What each role can access"
          subtitle="Baseline access by role, shown as admin sections. A staff member's actual access is this baseline plus anything granted below."
        />
        <div className="grid gap-3 md:grid-cols-3">
          {roleSectionSummaries.map(({ role: r, sectionLabels, unmapped }) => (
            <div key={r.key} className="rounded-xl border border-neon/10 bg-base-deep/40 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-ink-hi">{r.label}</p>
                <Chip tone={roleTone(r.key)}>{sectionLabels.length + unmapped.length === 0 ? 'no access' : `${sectionLabels.length + unmapped.length} sections`}</Chip>
              </div>
              {r.key === 'super_admin' ? (
                <p className="mt-2 text-xs text-ink-mid">Full access to every section, always.</p>
              ) : sectionLabels.length === 0 && unmapped.length === 0 ? (
                <p className="mt-2 text-xs text-ink-lo">No sections granted by default.</p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {sectionLabels.map((label) => (
                    <span key={label} className="rounded-full bg-brand-surface px-2 py-0.5 text-[11px] font-medium text-ink-mid">{label}</span>
                  ))}
                  {unmapped.map((label) => (
                    <span key={label} className="rounded-full bg-brand-surface px-2 py-0.5 text-[11px] font-medium text-ink-mid">{label}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Modal open={createOpen} onOpenChange={setCreateOpen} title="Create staff account" size="lg">
        <CreateStaffForm
          roles={roles}
          permissions={permissions}
          viewerRole={viewerRole}
          onDone={(msg) => {
            setCreateOpen(false);
            flashToast(msg);
            loadStaff();
          }}
        />
      </Modal>

      <Drawer
        open={!!drawerStaff}
        onOpenChange={(v) => { if (!v) setDrawerStaff(null); }}
        title={drawerStaff ? drawerStaff.username : ''}
        description="Edit role, status, password, or per-staff permission grants."
        width="560px"
      >
        {drawerStaff ? (
          <div className="space-y-6">
            <EditStaffPanel
              row={drawerStaff}
              roles={roles}
              permissions={permissions}
              viewerRole={viewerRole}
              onDone={(msg) => {
                setDrawerStaff(null);
                flashToast(msg);
                loadStaff();
              }}
              onClose={() => setDrawerStaff(null)}
            />
            {/* Meaningless for a super_admin row - they are unrestricted, so
                there is nothing to allocate or spend. */}
            {drawerStaff.role.key !== 'super_admin' ? (
              <StaffPointsPanel staffId={drawerStaff.id} viewerRole={viewerRole} />
            ) : null}
          </div>
        ) : null}
      </Drawer>
    </>
  );
}

function CreateStaffForm({ roles, permissions, viewerRole, onDone }: { roles: RoleSnapshot[]; permissions: PermissionRef[]; viewerRole: string; onDone: (msg: string) => void }) {
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleKey, setRoleKey] = useState<string>('staff');
  const [extras, setExtras] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          password,
          roleKey,
          extraPermissionIds: Array.from(extras),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const code = typeof data?.code === 'string' ? data.code : null;
        if (code === 'DUPLICATE_USERNAME') throw new Error('Username already taken.');
        if (code === 'DUPLICATE_PHONE') throw new Error('Phone already in use.');
        if (code === 'DUPLICATE_EMAIL') throw new Error('Email already in use.');
        if (code === 'ROLE_NOT_ALLOWED') throw new Error(data?.message ?? 'Role not permitted by your account.');
        throw new Error(data?.message ?? code ?? 'Create failed');
      }
      onDone(`Created ${username} as ${roleKey}.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="grid gap-3 md:grid-cols-2">
        <FormField label="Username" required>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="login name" />
        </FormField>
        <FormField label="Phone" required>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" />
        </FormField>
        <FormField label="Email">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="optional" />
        </FormField>
        <FormField label="Role" required>
          <Select value={roleKey} onChange={(e) => setRoleKey(e.target.value)}>
            {roles
              .filter((r) => (ROLE_KEYS as readonly string[]).includes(r.key))
              .map((r) => (<option key={r.key} value={r.key}>{r.label} ({r.key})</option>))}
          </Select>
        </FormField>
        <FormField label="Password" required hint="Minimum 8 characters. Never stored in plain text.">
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </FormField>
      </div>

      <div>
        <p className="text-sm font-semibold text-ink-hi">Access by section <span className="text-xs text-ink-lo">(beyond the role baseline)</span></p>
        <p className="mt-1 text-xs text-ink-mid">Pick the sections and actions this staff member should have. You choose clear names; the system keeps the technical codes.</p>
        <div className="mt-3">
          <PermissionPicker permissions={permissions} selected={extras} onChange={setExtras} viewerRole={viewerRole} />
        </div>
      </div>

      {err ? <p className="text-sm text-signal-danger">{err}</p> : null}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" variant="gold" loading={busy} disabled={!username.trim() || !phone.trim() || password.length < 8}>
          Create staff
        </Button>
      </div>
    </form>
  );
}

function EditStaffPanel({
  row,
  roles,
  permissions,
  viewerRole,
  onDone,
  onClose,
}: {
  row: StaffRow;
  roles: RoleSnapshot[];
  permissions: PermissionRef[];
  viewerRole: string;
  onDone: (msg: string) => void;
  onClose: () => void;
}) {
  const [roleKey, setRoleKey] = useState(row.role.key);
  const [status, setStatus] = useState(row.status);
  const [blockedReason, setBlockedReason] = useState(row.blockedReason ?? '');
  const [password, setPassword] = useState('');
  const [extras, setExtras] = useState<Set<string>>(new Set(row.extraPermissions.map((p) => p.id)));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const body: Record<string, unknown> = {
      roleKey,
      status,
      extraPermissionIds: Array.from(extras),
    };
    if (status === 'blocked' && blockedReason.trim()) body.blockedReason = blockedReason.trim();
    if (password) body.password = password;
    try {
      const res = await fetch(`/api/admin/staff/${row.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        const code = typeof data?.code === 'string' ? data.code : null;
        if (code === 'SELF_EDIT_FORBIDDEN') throw new Error('You cannot edit your own staff account here.');
        if (code === 'ROLE_NOT_ALLOWED') throw new Error(data?.message ?? 'Role change not permitted.');
        throw new Error(data?.message ?? code ?? 'Save failed');
      }
      const changes = Array.isArray(data?.changes) && data.changes.length > 0
        ? ` (${data.changes.join(', ')})`
        : '';
      onDone(`Updated ${row.username}${changes}.`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="rounded-lg border border-neon/10 bg-base-deep/40 p-3 text-sm">
        <p className="text-ink-mid">User <span className="font-semibold text-ink-hi">{row.username}</span> . phone <span className="font-mono">{row.phone}</span></p>
        <p className="text-xs text-ink-lo">Last login: {row.lastLoginAt ? new Date(row.lastLoginAt).toLocaleString() : 'never'}{row.lastLoginIp ? ` . ${row.lastLoginIp}` : ''}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <FormField label="Role" hint="Promotion to super_admin or admin requires super_admin.">
          <Select value={roleKey} onChange={(e) => setRoleKey(e.target.value)}>
            {roles.filter((r) => (ROLE_KEYS as readonly string[]).includes(r.key)).map((r) => (
              <option key={r.key} value={r.key}>{r.label} ({r.key})</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value as StaffRow['status'])}>
            <option value="active">active</option>
            <option value="blocked">blocked (suspended)</option>
            <option value="pending">pending</option>
          </Select>
        </FormField>
      </div>

      {status === 'blocked' ? (
        <FormField label="Blocked reason (optional)" hint="Visible on the suspended-staff banner.">
          <Textarea rows={2} value={blockedReason} onChange={(e) => setBlockedReason(e.target.value)} placeholder="e.g. fraud investigation, awaiting KYC reapproval" />
        </FormField>
      ) : null}

      <FormField label="New password (optional)" hint="Set only to force a reset. Existing sessions will be revoked.">
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="leave blank to keep current" />
      </FormField>

      <div>
        <p className="text-sm font-semibold text-ink-hi">Access by section <span className="text-xs text-ink-lo">(beyond the role baseline)</span></p>
        <p className="mt-1 text-xs text-ink-mid">Effective access = role baseline plus anything ticked here. Changes apply immediately and revoke active sessions.</p>
        <div className="mt-3">
          <PermissionPicker permissions={permissions} selected={extras} onChange={setExtras} viewerRole={viewerRole} />
        </div>
      </div>

      {err ? <p className="text-sm text-signal-danger">{err}</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex flex-wrap gap-2">
          {row.status === 'active' ? (
            <Chip tone="ok"><span className="inline-flex items-center gap-1"><Sparkles className="h-3 w-3" /> active</span></Chip>
          ) : row.status === 'blocked' ? (
            <Chip tone="danger"><span className="inline-flex items-center gap-1"><Ban className="h-3 w-3" /> blocked</span></Chip>
          ) : (
            <Chip tone="warn">pending</Chip>
          )}
          {password ? <Chip tone="warn"><span className="inline-flex items-center gap-1"><KeyRound className="h-3 w-3" /> will reset password</span></Chip> : null}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="gold" loading={busy}>Save changes</Button>
        </div>
      </div>

      <p className={cn('mt-2 text-[11px]', status === 'blocked' ? 'text-signal-warn' : 'text-ink-lo')}>
        <ShieldCheck className="mr-1 inline h-3 w-3" />
        Privilege-changing actions (role / status / password / permissions) revoke active sessions so the new RBAC takes effect immediately.
      </p>
    </form>
  );
}

interface PointsHistoryRow {
  id: string;
  type: string;
  amount: number;
  before: number;
  after: number;
  actorUsername: string | null;
  targetUsername: string | null;
  reason: string | null;
  createdAt: string;
}

/**
 * Staff Point Wallet panel. The client's core security requirement: a staff
 * member with Balance Management access has a hard ceiling on how much they
 * can ever credit into player wallets, and this is where a Super Admin
 * reviews usage and tops it up. Self-contained (own fetch, own save) so it
 * cannot interfere with EditStaffPanel's role/permission form above it.
 */
function StaffPointsPanel({ staffId, viewerRole }: { staffId: string; viewerRole: string }) {
  const isSuperAdmin = viewerRole === 'super_admin';
  const [balance, setBalance] = useState<number | null>(null);
  const [history, setHistory] = useState<PointsHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [grantAmount, setGrantAmount] = useState('');
  const [grantReason, setGrantReason] = useState('');
  const [granting, setGranting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch(`/api/admin/staff/${staffId}/points`, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Failed to load');
      setBalance(Number(j.balance ?? 0));
      setHistory(Array.isArray(j.history) ? j.history : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [staffId]);

  useEffect(() => { void load(); }, [load]);

  const grant = async () => {
    setError(null);
    setNotice(null);
    setGranting(true);
    try {
      const r = await fetch(`/api/admin/staff/${staffId}/points`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ amount: Number(grantAmount), reason: grantReason.trim() }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Grant failed');
      setNotice(`Granted. New balance ${formatBDT(Number(j?.balance?.after ?? 0))}.`);
      setGrantAmount('');
      setGrantReason('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Grant failed');
    } finally {
      setGranting(false);
    }
  };

  return (
    <div className="border-t border-neon/10 pt-5">
      <h3 className="mb-1 text-sm font-semibold text-ink-hi">Staff points</h3>
      <p className="mb-3 text-xs text-ink-lo">
        Every balance credit this staff member makes to a player spends 1:1 from this pool. At zero, they cannot credit
        anyone until you grant more.
      </p>

      {loading ? (
        <p className="text-sm text-ink-mid">Loading...</p>
      ) : (
        <>
          <div className="mb-3 rounded-lg border border-neon/10 bg-base-deep/40 p-3">
            <p className="text-[11px] uppercase tracking-wider text-ink-lo">Current balance</p>
            <p className={cn('text-lg font-bold', (balance ?? 0) > 0 ? 'text-ink-hi' : 'text-signal-danger')}>
              {formatBDT(balance ?? 0)}
            </p>
          </div>

          {isSuperAdmin ? (
            <div className="mb-4 flex flex-wrap items-end gap-2">
              <div className="w-32">
                <FormField label="Grant amount (BDT)">
                  <Input type="number" min="0.01" step="0.01" value={grantAmount} onChange={(e) => setGrantAmount(e.target.value)} />
                </FormField>
              </div>
              <div className="min-w-[14rem] flex-1">
                <FormField label="Reason">
                  <Input value={grantReason} onChange={(e) => setGrantReason(e.target.value)} placeholder="e.g. monthly top-up" />
                </FormField>
              </div>
              <Button
                size="sm"
                variant="gold"
                loading={granting}
                disabled={!(Number(grantAmount) > 0) || grantReason.trim().length < 3}
                onClick={grant}
              >
                Grant
              </Button>
            </div>
          ) : null}

          <div aria-live="polite">
            {notice ? <p className="mb-2 text-sm text-emerald-600">{notice}</p> : null}
            {error ? <p className="mb-2 text-sm text-signal-danger">{error}</p> : null}
          </div>

          <p className="mb-1 text-xs font-semibold text-ink-hi">Recent activity</p>
          {history.length === 0 ? (
            <p className="text-sm text-ink-mid">No point activity yet.</p>
          ) : (
            <div className="max-h-64 overflow-y-auto rounded-lg border border-neon/10">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-base-deep text-[10px] uppercase tracking-wider text-ink-lo">
                  <tr>
                    <th scope="col" className="px-2 py-1.5 font-medium">When</th>
                    <th scope="col" className="px-2 py-1.5 font-medium">Type</th>
                    <th scope="col" className="px-2 py-1.5 font-medium">Who / player</th>
                    <th scope="col" className="px-2 py-1.5 text-right font-medium">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className="border-t border-neon/5">
                      <td className="whitespace-nowrap px-2 py-1.5 text-ink-mid">{new Date(h.createdAt).toLocaleString()}</td>
                      <td className="px-2 py-1.5 text-ink-hi">{h.type}</td>
                      <td className="px-2 py-1.5 text-ink-mid">
                        {h.type === 'spend' ? h.targetUsername : h.actorUsername ?? '.'}
                      </td>
                      <td className={cn('whitespace-nowrap px-2 py-1.5 text-right font-semibold', h.amount < 0 ? 'text-signal-danger' : 'text-signal-ok')}>
                        {h.amount < 0 ? '' : '+'}{formatBDT(h.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
