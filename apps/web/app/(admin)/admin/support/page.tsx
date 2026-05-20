'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Drawer } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { mockTickets } from '@/lib/mock/activity';
import { LifeBuoy, Send } from 'lucide-react';
import { formatDateTime } from '@/lib/utils/format';
import { useLang } from '@/lib/i18n/context';
import type { SupportTicket } from '@/types';

export default function AdminSupportPage() {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const [ticket, setTicket] = useState<SupportTicket | null>(null);

  return (
    <>
      <PageHeader title="Support Messages" subtitle={`${mockTickets.filter((t) => t.status !== 'closed').length} open`} icon={<LifeBuoy className="h-5 w-5" />} />

      <Card padding="none" className="overflow-hidden">
        <ul className="divide-y divide-neon/10">
          {mockTickets.map((t) => (
            <li key={t.id} className="flex flex-col items-start gap-3 p-4 md:flex-row md:items-center">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-ink-hi truncate">{t.subject}</p>
                  <Chip tone={t.status === 'open' ? 'info' : t.status === 'pending' ? 'warn' : 'neutral'}>{t.status}</Chip>
                </div>
                <p className="mt-1 text-xs text-ink-lo">{t.user} · {formatDateTime(t.createdAt, lang)}</p>
                <p className="mt-1 text-sm text-ink-mid line-clamp-1">{t.body}</p>
              </div>
              <Button size="sm" variant="neon" onClick={() => { setTicket(t); setOpen(true); }}>Open</Button>
            </li>
          ))}
        </ul>
      </Card>

      <Drawer open={open} onOpenChange={setOpen} title={ticket?.subject} description={ticket?.user} width="500px">
        {ticket ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-neon/10 bg-base-deep/40 p-3 text-sm text-ink-mid">{ticket.body}</div>
            <div>
              <p className="mb-2 text-sm font-semibold text-ink-hi">Reply</p>
              <Textarea rows={5} placeholder="Type a response to the user..." />
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="ghost">Mark closed</Button>
                <Button leftIcon={<Send className="h-3.5 w-3.5" />}>Send</Button>
              </div>
            </div>
          </div>
        ) : null}
      </Drawer>
    </>
  );
}
