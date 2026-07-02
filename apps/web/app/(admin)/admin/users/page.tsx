// Built by Anointed Coder.
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { UserDetailDrawer, type AdminUserSummary, type AdminUserDetail } from '@/components/admin/UserDetailDrawer';
import { BalanceAdjustModal } from '@/components/admin/BalanceAdjustModal';
import { formatBDT, formatDate } from '@/lib/utils/format';
import { useLang } from '@/lib/i18n/context';
import { Users, RefreshCw } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { cn } from '@/lib/utils/cn';

export default function AdminUsersPage() {
  const { lang } = useLang();
  const [rows, setRows] = useState<AdminUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [balanceUser, setBalanceUser] = useState<AdminUserSummary | null>(null);
  const [balanceOpen, setBalanceOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setRefreshing(true);
    try {
      const res = await fetch('/api/admin/users?take=200', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Failed');
      const users = (data.users as Array<{
        id: string;
        username: string;
        phone: string;
        status: string;
        country: string;
        language: string;
        createdAt: string;
        role: { key: string; label: string };
        wallet: { balance: number | string; bonusBalance: number | string; lockedBalance: number | string } | null;
      }>).map<AdminUserSummary>((u) => ({
        id: u.id,
        username: u.username,
        phone: u.phone,
        status: u.status as AdminUserSummary['status'],
        roleKey: u.role.key,
        roleLabel: u.role.label,
        country: u.country,
        language: u.language as 'bn' | 'en',
        createdAt: u.createdAt,
        balance: Number(u.wallet?.balance ?? 0),
      }));
      setRows(users);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const columns = useMemo<ColumnDef<AdminUserSummary>[]>(
    () => [
      {
        header: 'User',
        accessorKey: 'username',
        cell: ({ row }) => (
          <div>
            <p className="font-semibold text-ink-hi">{row.original.username}</p>
            <p className="font-mono text-[11px] text-ink-lo">{row.original.phone}</p>
          </div>
        ),
      },
      { header: 'Role', accessorKey: 'roleKey', cell: ({ row }) => <span className="capitalize text-ink-mid">{row.original.roleLabel ?? row.original.roleKey.replace('_', ' ')}</span> },
      {
        header: 'Status',
        accessorKey: 'status',
        cell: ({ getValue }) => {
          const v = String(getValue());
          return <Chip tone={v === 'active' ? 'ok' : v === 'blocked' ? 'danger' : 'warn'}>{v}</Chip>;
        },
      },
      { header: 'Balance', accessorKey: 'balance', cell: ({ getValue }) => <span className="font-semibold text-gradient-gold">{formatBDT(Number(getValue()))}</span> },
      { header: 'Joined', accessorKey: 'createdAt', cell: ({ getValue }) => <span className="text-ink-lo">{formatDate(String(getValue()), lang)}</span> },
      {
        header: '',
        id: 'actions',
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setSelectedId(row.original.id); setDrawerOpen(true); }}>View</Button>
            <Button size="sm" variant="neon" onClick={() => { setBalanceUser(row.original); setBalanceOpen(true); }}>Adjust</Button>
          </div>
        ),
      },
    ],
    [lang],
  );

  // Fetch full detail (with aggregates) when the drawer opens.
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    if (!drawerOpen || !selectedId) {
      setDetail(null);
      setDetailError(null);
      return;
    }
    let alive = true;
    setDetailLoading(true);
    setDetailError(null);
    fetch(`/api/admin/users/${selectedId}`, { cache: 'no-store' })
      .then((r) => r.json().then((b) => ({ ok: r.ok, body: b })))
      .then(({ ok, body }) => {
        if (!alive) return;
        if (!ok) {
          setDetailError(body?.message ?? body?.code ?? 'Failed to load user');
          setDetail(null);
        } else {
          setDetail(body.user as AdminUserDetail);
        }
      })
      .catch((e) => { if (alive) setDetailError(e instanceof Error ? e.message : 'Failed'); })
      .finally(() => { if (alive) setDetailLoading(false); });
    return () => { alive = false; };
  }, [drawerOpen, selectedId]);

  return (
    <>
      <PageHeader
        title="User Management"
        subtitle={loading ? 'Loading...' : `${rows.length} accounts`}
        icon={<Users className="h-5 w-5" />}
        action={
          <Button variant="neon" leftIcon={<RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />} onClick={load}>
            Refresh
          </Button>
        }
      />

      {toast ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-ok">{toast}</p></Card> : null}
      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{error}</p></Card> : null}

      {loading ? (
        <Card padding="lg">Loading...</Card>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          searchPlaceholder="Search by username or phone"
          searchKey="username"
          onRowClick={(u) => { setSelectedId(u.id); setDrawerOpen(true); }}
        />
      )}

      <UserDetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        detail={detail}
        loading={detailLoading}
        error={detailError}
        onAdjustBalance={(u) => { setBalanceUser(u); setBalanceOpen(true); setDrawerOpen(false); }}
        onStatusChange={(nextStatus, reason) => {
          if (!detail) return;
          setDetailError(null);
          fetch(`/api/admin/users/${detail.id}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              status: nextStatus,
              blockedReason: nextStatus === 'blocked' ? (reason ?? null) : null,
            }),
          })
            .then((r) => r.json().catch(() => null).then((body) => ({ ok: r.ok, body })))
            .then(({ ok, body }) => {
              if (!ok) {
                // Do NOT flip the drawer state: the server refused the
                // change, so the account is still in its old status.
                setDetailError(
                  `${body?.message ?? body?.code ?? 'Status change failed'} (Status change failed. স্ট্যাটাস পরিবর্তন ব্যর্থ হয়েছে।)`,
                );
                return;
              }
              const updated = body?.user as { blockedReason?: string | null; blockedAt?: string | null } | undefined;
              setDetail({
                ...detail,
                status: nextStatus,
                blockedReason: nextStatus === 'blocked' ? (updated?.blockedReason ?? reason ?? null) : null,
                blockedAt: nextStatus === 'blocked' ? (updated?.blockedAt ?? new Date().toISOString()) : null,
              });
              setToast(nextStatus === 'blocked'
                ? `${detail.username} blocked. অ্যাকাউন্টটি ব্লক করা হয়েছে।`
                : `${detail.username} unblocked. অ্যাকাউন্টটি আনব্লক করা হয়েছে।`);
              setTimeout(() => setToast(null), 4500);
              load();
            })
            .catch((e) => {
              setDetailError(
                `${e instanceof Error ? e.message : 'Status change failed'} (Status change failed. স্ট্যাটাস পরিবর্তন ব্যর্থ হয়েছে।)`,
              );
            });
        }}
      />

      <BalanceAdjustModal
        open={balanceOpen}
        onOpenChange={setBalanceOpen}
        user={balanceUser as unknown as Parameters<typeof BalanceAdjustModal>[0]['user']}
        onConfirm={async (payload) => {
          // Real wallet write. POST /api/admin/users/[id]/balance takes a
          // SIGNED amount (positive credits, negative debits), a reason,
          // and a type restricted to adjust | bonus | referral. The modal
          // throws-through: on failure the error renders inside the modal
          // and the modal stays open; on success it closes itself.
          if (!balanceUser) return;
          const signed = payload.type === 'credit' ? Math.abs(payload.amount) : -Math.abs(payload.amount);
          const res = await fetch(`/api/admin/users/${balanceUser.id}/balance`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ amount: signed, reason: payload.reason, type: 'adjust' }),
          });
          const data = await res.json().catch(() => null);
          if (!res.ok) {
            throw new Error(data?.message ?? data?.code ?? 'Adjustment failed');
          }
          setToast(
            `${payload.type === 'credit' ? 'Credited' : 'Debited'} ${formatBDT(Math.abs(payload.amount))} ${payload.type === 'credit' ? 'to' : 'from'} ${balanceUser.username}. New balance ${formatBDT(Number(data?.balance?.after ?? 0))}. ব্যালেন্স সফলভাবে আপডেট হয়েছে।`,
          );
          setTimeout(() => setToast(null), 4500);
          await load();
        }}
      />
    </>
  );
}
