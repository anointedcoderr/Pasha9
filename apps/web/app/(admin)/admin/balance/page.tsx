'use client';

import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { BalanceAdjustModal } from '@/components/admin/BalanceAdjustModal';
import { mockUsers } from '@/lib/mock/users';
import { formatBDT } from '@/lib/utils/format';
import { Button } from '@/components/ui/Button';
import { Wallet, ArrowUpToLine, ArrowDownToLine } from 'lucide-react';
import type { User } from '@/types';
import type { ColumnDef } from '@tanstack/react-table';

export default function AdminBalancePage() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  const columns = useMemo<ColumnDef<User>[]>(() => [
    { header: 'User', accessorKey: 'username', cell: ({ row }) => <div><p className="font-medium text-ink-hi">{row.original.username}</p><p className="text-xs text-ink-lo">{row.original.phone}</p></div> },
    { header: 'Available', accessorKey: 'balance', cell: ({ getValue }) => <span className="font-semibold text-gradient-gold">{formatBDT(Number(getValue()))}</span> },
    { header: 'Bonus', accessorKey: 'bonusBalance', cell: ({ getValue }) => <span className="text-ink-mid">{formatBDT(Number(getValue()))}</span> },
    { header: 'Locked', accessorKey: 'lockedBalance', cell: ({ getValue }) => <span className="text-ink-mid">{formatBDT(Number(getValue()))}</span> },
    { header: 'Total Deposit', accessorKey: 'totalDeposit', cell: ({ getValue }) => <span className="text-ink-mid">{formatBDT(Number(getValue()))}</span> },
    { header: 'Total Withdraw', accessorKey: 'totalWithdraw', cell: ({ getValue }) => <span className="text-ink-mid">{formatBDT(Number(getValue()))}</span> },
    {
      header: '',
      id: 'actions',
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="neon" leftIcon={<ArrowDownToLine className="h-3.5 w-3.5" />} onClick={() => { setUser(row.original); setOpen(true); }}>Credit</Button>
          <Button size="sm" variant="ghost" leftIcon={<ArrowUpToLine className="h-3.5 w-3.5" />} onClick={() => { setUser(row.original); setOpen(true); }}>Debit</Button>
        </div>
      ),
    },
  ], []);

  return (
    <>
      <PageHeader title="Balance Management" subtitle="Every change creates an audit log and transaction record" icon={<Wallet className="h-5 w-5" />} />
      <DataTable columns={columns} data={mockUsers} searchPlaceholder="Search user" searchKey="username" />
      <BalanceAdjustModal open={open} onOpenChange={setOpen} user={user} onConfirm={(p) => console.info('balance change', p)} />
    </>
  );
}
