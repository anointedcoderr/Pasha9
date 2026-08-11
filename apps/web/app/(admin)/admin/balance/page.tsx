// Built by Anointed Coder.
//
// Real wallet ops surface. Reads users with wallet rows from
// /api/admin/users, lets the operator credit or debit the wallet
// through the BalanceAdjustModal which posts to
// /api/admin/users/[id]/balance.

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import { BalanceAdjustModal } from '@/components/admin/BalanceAdjustModal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Wallet, ArrowUpToLine, ArrowDownToLine, RefreshCw, Search, Coins } from 'lucide-react';
import { formatBDT } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { useAdminPermissions } from '@/lib/auth/use-admin-permissions';
import type { ColumnDef } from '@tanstack/react-table';

interface WalletRow {
  id: string;
  username: string;
  phone: string;
  balance: number;
  bonusBalance: number;
  lockedBalance: number;
  lottoBalance: number;
}

interface ApiUser {
  id: string;
  username: string;
  phone: string;
  wallet: { balance: number | string; bonusBalance: number | string; lockedBalance: number | string; lottoBalance?: number | string } | null;
}

export default function AdminBalancePage() {
  const { loaded: roleLoaded, role } = useAdminPermissions();
  // Optimistic while role is loading: unrestricted is the least surprising
  // default and the server enforces the real boundary regardless, so this
  // never needs to be treated as a security gate, only a UX one.
  const isSuperAdmin = !roleLoaded || role === 'super_admin';
  const [points, setPoints] = useState<number | null>(null);
  const [pointsLoaded, setPointsLoaded] = useState(false);

  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<WalletRow | null>(null);
  const [mode, setMode] = useState<'credit' | 'debit'>('credit');
  const [rows, setRows] = useState<WalletRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadPoints = useCallback(async () => {
    try {
      const r = await fetch('/api/staff/points', { cache: 'no-store' });
      const j = await r.json();
      if (r.ok) setPoints(j?.unrestricted ? null : Number(j?.balance ?? 0));
    } catch {
      // Non-fatal: the credit button simply stays enabled and the server's
      // own check is still the real gate if points turn out to be short.
    } finally {
      setPointsLoaded(true);
    }
  }, []);

  useEffect(() => { if (!isSuperAdmin) void loadPoints(); }, [isSuperAdmin, loadPoints]);

  const refresh = useCallback(async (q?: string) => {
    setRefreshing(true);
    setError(null);
    try {
      const url = q && q.trim() ? `/api/admin/users?take=200&q=${encodeURIComponent(q.trim())}` : '/api/admin/users?take=200';
      const r = await fetch(url, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Failed to load');
      const list = (j.users as ApiUser[]).map((u) => ({
        id: u.id,
        username: u.username,
        phone: u.phone,
        balance: Number(u.wallet?.balance ?? 0),
        bonusBalance: Number(u.wallet?.bonusBalance ?? 0),
        lockedBalance: Number(u.wallet?.lockedBalance ?? 0),
        lottoBalance: Number(u.wallet?.lottoBalance ?? 0),
      }));
      setRows(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const columns = useMemo<ColumnDef<WalletRow>[]>(() => [
    { header: 'User', accessorKey: 'username', cell: ({ row }) => (
      <div>
        <p className="font-medium text-ink-hi">{row.original.username}</p>
        <p className="text-xs text-ink-lo">{row.original.phone}</p>
      </div>
    ) },
    { header: 'Available', accessorKey: 'balance', cell: ({ getValue }) => <span className="font-semibold text-gradient-gold">{formatBDT(Number(getValue()))}</span> },
    { header: 'Bonus',  accessorKey: 'bonusBalance',  cell: ({ getValue }) => <span className="text-ink-mid">{formatBDT(Number(getValue()))}</span> },
    { header: 'Locked', accessorKey: 'lockedBalance', cell: ({ getValue }) => <span className="text-ink-mid">{formatBDT(Number(getValue()))}</span> },
    { header: 'Lotto',  accessorKey: 'lottoBalance',  cell: ({ getValue }) => <span className="text-ink-mid">{formatBDT(Number(getValue()))}</span> },
    {
      header: '',
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="neon"
            leftIcon={<ArrowDownToLine className="h-3.5 w-3.5" />}
            disabled={!isSuperAdmin && pointsLoaded && (points ?? 0) <= 0}
            onClick={() => { setUser(row.original); setMode('credit'); setOpen(true); }}
          >
            Credit
          </Button>
          {/*
            Debit only ever renders for a super_admin. Not just disabled: a
            staff member cannot reduce a player's balance at all, by the
            client's explicit requirement, and the server rejects it
            regardless - this keeps the control from implying an ability
            that does not exist for them.
          */}
          {isSuperAdmin ? (
            <Button size="sm" variant="ghost" leftIcon={<ArrowUpToLine className="h-3.5 w-3.5" />} onClick={() => { setUser(row.original); setMode('debit'); setOpen(true); }}>Debit</Button>
          ) : null}
        </div>
      ),
    },
  ], [isSuperAdmin, points, pointsLoaded]);

  // Called by BalanceAdjustModal on submit. The API enum is
  // adjust | bonus | referral, so the modal's credit/debit choice maps
  // onto the SIGN of the amount (positive credits, negative debits)
  // with type always 'adjust'. The sign comes from the modal's Type
  // select, the same field that drives the New balance preview, so the
  // preview and the actual write always agree. Throws on failure: the
  // modal renders the error inside itself and stays open.
  const onConfirm = async (payload: { amount: number; reason: string; type: 'credit' | 'debit' }) => {
    if (!user) return;
    const signed = payload.type === 'credit' ? Math.abs(payload.amount) : -Math.abs(payload.amount);
    const r = await fetch(`/api/admin/users/${user.id}/balance`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        amount: signed,
        reason: payload.reason,
        type: 'adjust',
      }),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Adjustment failed');
    setToast(
      `${payload.type === 'credit' ? 'Credited' : 'Debited'} ${formatBDT(Math.abs(payload.amount))} ${payload.type === 'credit' ? 'to' : 'from'} ${user.username}. New balance ${formatBDT(Number(j?.balance?.after ?? 0))}. ব্যালেন্স সফলভাবে আপডেট হয়েছে।`,
    );
    setTimeout(() => setToast(null), 4500);
    await refresh(search);
    if (!isSuperAdmin) await loadPoints();
  };

  return (
    <>
      <PageHeader
        title="Balance Management"
        subtitle={loading ? 'Loading...' : isSuperAdmin ? `${rows.length} users . click Credit or Debit to adjust` : `${rows.length} users . you can only credit, from your point balance below`}
        icon={<Wallet className="h-5 w-5" />}
        action={
          <div className="flex items-center gap-3">
            {!isSuperAdmin && pointsLoaded ? (
              <span
                className={cn(
                  'inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold',
                  (points ?? 0) > 0 ? 'border-neon/20 bg-base-panel/60 text-ink-hi' : 'border-signal-danger/40 bg-signal-danger/10 text-signal-danger',
                )}
                title="Your remaining staff credit points. Ask a Super Admin for more if this runs out."
              >
                <Coins className="h-3.5 w-3.5" aria-hidden="true" />
                {formatBDT(points ?? 0)} points left
              </span>
            ) : null}
            <Button variant="ghost" leftIcon={<RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />} onClick={() => refresh(search)}>
              Refresh
            </Button>
          </div>
        }
      />

      {toast ? <Card padding="md" className="mb-4 border-l-4 border-emerald-400/60"><p className="text-sm text-emerald-300">{toast}</p></Card> : null}
      {error ? <Card padding="md" className="mb-4 border-l-4 border-rose-400/60"><p className="text-sm text-rose-300">{error}</p></Card> : null}

      <Card padding="sm" className="mb-3">
        <form
          onSubmit={(e) => { e.preventDefault(); void refresh(search); }}
          className="flex items-center gap-2"
        >
          <Search className="h-4 w-4 text-ink-lo" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by username, phone or referral code"
          />
          <Button variant="neon" type="submit">Search</Button>
        </form>
      </Card>

      <DataTable columns={columns} data={rows} searchPlaceholder="Filter on screen" searchKey="username" />

      <BalanceAdjustModal
        open={open}
        onOpenChange={setOpen}
        user={user ? {
          id: user.id,
          username: user.username,
          phone: user.phone,
          balance: user.balance,
          bonusBalance: user.bonusBalance,
          lockedBalance: user.lockedBalance,
        } as never : null}
        initialType={mode}
        allowDebit={isSuperAdmin}
        onConfirm={onConfirm}
      />
    </>
  );
}
