'use client';

import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { UserDetailDrawer } from '@/components/admin/UserDetailDrawer';
import { BalanceAdjustModal } from '@/components/admin/BalanceAdjustModal';
import { mockUsers } from '@/lib/mock/users';
import { formatBDT, formatDate } from '@/lib/utils/format';
import { useLang } from '@/lib/i18n/context';
import { Users } from 'lucide-react';
import type { User } from '@/types';
import type { ColumnDef } from '@tanstack/react-table';

export default function AdminUsersPage() {
  const { lang } = useLang();
  const [selected, setSelected] = useState<User | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [balanceUser, setBalanceUser] = useState<User | null>(null);
  const [balanceOpen, setBalanceOpen] = useState(false);

  const columns = useMemo<ColumnDef<User>[]>(() => [
    {
      header: 'User',
      accessorKey: 'username',
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-ink-hi">{row.original.username}</p>
          <p className="text-xs text-ink-lo">{row.original.phone}</p>
        </div>
      ),
    },
    { header: 'Role', accessorKey: 'role', cell: ({ getValue }) => <span className="capitalize text-ink-mid">{String(getValue()).replace('_', ' ')}</span> },
    { header: 'Status', accessorKey: 'status', cell: ({ getValue }) => <Chip tone={getValue() === 'active' ? 'ok' : getValue() === 'blocked' ? 'danger' : 'warn'}>{String(getValue())}</Chip> },
    { header: 'Balance', accessorKey: 'balance', cell: ({ getValue }) => <span className="font-semibold text-gradient-gold">{formatBDT(Number(getValue()))}</span> },
    { header: 'Total Deposit', accessorKey: 'totalDeposit', cell: ({ getValue }) => <span className="text-ink-mid">{formatBDT(Number(getValue()))}</span> },
    { header: 'Joined', accessorKey: 'createdAt', cell: ({ getValue }) => <span className="text-ink-lo">{formatDate(String(getValue()), lang)}</span> },
    {
      header: '',
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => { setSelected(row.original); setDrawerOpen(true); }}>View</Button>
          <Button size="sm" variant="neon" onClick={() => { setBalanceUser(row.original); setBalanceOpen(true); }}>Adjust</Button>
        </div>
      ),
    },
  ], [lang]);

  return (
    <>
      <PageHeader title="User Management" subtitle={`${mockUsers.length} accounts`} icon={<Users className="h-5 w-5" />} />
      <DataTable
        columns={columns}
        data={mockUsers}
        searchPlaceholder="Search by username or phone"
        searchKey="username"
        onRowClick={(u) => { setSelected(u); setDrawerOpen(true); }}
      />

      <UserDetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        user={selected}
        onAdjustBalance={(u) => { setBalanceUser(u); setBalanceOpen(true); setDrawerOpen(false); }}
      />
      <BalanceAdjustModal
        open={balanceOpen}
        onOpenChange={setBalanceOpen}
        user={balanceUser}
        onConfirm={(payload) => {
          console.info('balance adjustment (mock)', payload);
        }}
      />
    </>
  );
}
