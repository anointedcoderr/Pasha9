'use client';

import { useMemo } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { DataTable } from '@/components/ui/DataTable';
import { Chip } from '@/components/ui/Chip';
import { mockActivity } from '@/lib/mock/activity';
import { formatDateTime } from '@/lib/utils/format';
import { useLang } from '@/lib/i18n/context';
import { ClipboardList } from 'lucide-react';
import type { ActivityLog } from '@/types';
import type { ColumnDef } from '@tanstack/react-table';

export default function AdminActivityPage() {
  const { lang } = useLang();

  const columns = useMemo<ColumnDef<ActivityLog>[]>(() => [
    { header: 'Actor', accessorKey: 'actor', cell: ({ row }) => <div><p className="font-medium text-ink-hi">{row.original.actor}</p><p className="text-xs uppercase tracking-wider text-ink-lo">{row.original.actorRole.replace('_', ' ')}</p></div> },
    { header: 'Action', accessorKey: 'action', cell: ({ getValue }) => {
      const v = String(getValue());
      const tone = v.includes('REJECT') || v.includes('BLOCK') ? 'danger' : v.includes('SYSTEM') || v.includes('AUTO') ? 'info' : 'ok';
      return <Chip tone={tone}>{v}</Chip>;
    } },
    { header: 'Target', accessorKey: 'target', cell: ({ getValue }) => <code className="font-mono text-xs text-ink-mid">{String(getValue())}</code> },
    { header: 'Detail', accessorKey: 'detail', cell: ({ getValue }) => <span className="text-ink-mid">{String(getValue() ?? '')}</span> },
    { header: 'When', accessorKey: 'createdAt', cell: ({ getValue }) => <span className="text-ink-lo">{formatDateTime(String(getValue()), lang)}</span> },
  ], [lang]);

  return (
    <>
      <PageHeader title="Admin Activity Log" subtitle="Append-only audit trail of admin actions" icon={<ClipboardList className="h-5 w-5" />} />
      <DataTable columns={columns} data={mockActivity} searchPlaceholder="Search action, target, actor" pageSize={15} />
    </>
  );
}
