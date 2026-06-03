// Built by Anointed Coder.
//
// /lotto/my-tickets - dedicated player page.
//
// Pulls /api/lotto/me which already returns the user's tickets +
// winnings + accrual snapshot. Active / used / winning / expired
// columns are derived from LotteryTicket.status: issued (active),
// won (winning), lost (used), void (expired).

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/site/PageHeader';
import { BackBar } from '@/components/site/BackBar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Ticket, LogIn, RefreshCw, Trophy } from 'lucide-react';
import { useT, useLang } from '@/lib/i18n/context';
import { formatDateTime } from '@/lib/utils/format';

interface MyResp {
  tickets: Array<{ id: string; number: string; status: string; source: string; drawId: string | null; generatedAt: string }>;
  progress: { totalApprovedDeposits: number; earnedTickets: number; toNextBlock: number };
  rules: { ticketsPerBlock: number; blockAmount: number; digits: number; drawTimeLabel: string };
}

type TabKey = 'active' | 'won' | 'used' | 'all';

export default function LottoMyTicketsPage() {
  const t = useT();
  const { lang } = useLang();
  const [data, setData] = useState<MyResp | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('active');

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/lotto/me', { cache: 'no-store', credentials: 'include' });
      if (r.status === 401) { setNeedsLogin(true); setData(null); return; }
      const j = await r.json().catch(() => null);
      if (!r.ok || !j) return;
      setNeedsLogin(false);
      setData(j as MyResp);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (needsLogin) {
    return (
      <div className="space-y-6 pb-24 md:pb-6">
        <BackBar title={lang === 'bn' ? 'আমার টিকিট' : 'My tickets'} />
        <Card padding="lg" className="mx-auto max-w-md text-center">
          <p className="text-sm text-ink-mid">{lang === 'bn' ? 'টিকিট দেখতে লগইন করুন।' : 'Log in to view your tickets.'}</p>
          <div className="mt-4">
            <Link href="/?login=1" className="btn-yellow inline-flex h-10 items-center rounded-lg px-4 text-sm">
              <LogIn className="mr-1.5 h-4 w-4" /> {lang === 'bn' ? 'লগইন' : 'Log in'}
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const tickets = data?.tickets ?? [];
  const filtered = (() => {
    if (tab === 'active') return tickets.filter((tk) => tk.status === 'issued');
    if (tab === 'won') return tickets.filter((tk) => tk.status === 'won');
    if (tab === 'used') return tickets.filter((tk) => tk.status === 'lost' || tk.status === 'void');
    return tickets;
  })();

  const statusTone = (s: string): 'ok' | 'warn' | 'neutral' | 'danger' => {
    if (s === 'won') return 'ok';
    if (s === 'issued') return 'warn';
    if (s === 'lost') return 'neutral';
    return 'danger';
  };

  return (
    <div className="space-y-6 pb-24 md:pb-6">
      <BackBar title={lang === 'bn' ? 'আমার টিকিট' : 'My tickets'} />
      <PageHeader
        title={lang === 'bn' ? 'আমার টিকিট' : 'My tickets'}
        subtitle={lang === 'bn' ? 'লটো টিকিট ও ফলাফল' : 'Active, used, and winning lotto tickets'}
        icon={<Ticket className="h-5 w-5" />}
        action={
          <div className="flex gap-2">
            <Link href="/lotto/my-winnings" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-brand-divider bg-brand-paper px-3 text-xs font-bold text-brand-ink hover:border-brand-yellow-500">
              <Trophy className="h-3.5 w-3.5" /> {lang === 'bn' ? 'আমার জয়' : 'My winnings'}
            </Link>
            <Button variant="ghost" leftIcon={<RefreshCw className="h-3.5 w-3.5" />} onClick={load}>{lang === 'bn' ? 'রিফ্রেশ' : 'Refresh'}</Button>
          </div>
        }
      />

      {data?.progress ? (
        <Card padding="md">
          <p className="text-[10px] font-bold uppercase tracking-wider text-ink-lo">{lang === 'bn' ? 'অ্যাক্রুয়াল' : 'Accrual progress'}</p>
          <div className="mt-2 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-[10px] uppercase text-ink-lo">{lang === 'bn' ? 'মোট জমা' : 'Approved deposits'}</p>
              <p className="font-bold text-ink-hi tabular-nums">BDT {Math.round(data.progress.totalApprovedDeposits).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-ink-lo">{lang === 'bn' ? 'অর্জিত টিকিট' : 'Earned tickets'}</p>
              <p className="font-bold text-ink-hi tabular-nums">{data.progress.earnedTickets}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase text-ink-lo">{lang === 'bn' ? 'পরবর্তী টিকিটের জন্য' : 'To next ticket block'}</p>
              <p className="font-bold text-ink-hi tabular-nums">BDT {Math.round(data.progress.toNextBlock).toLocaleString()}</p>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-ink-mid">
            {lang === 'bn'
              ? `প্রতি ${data.rules.blockAmount} টাকা অনুমোদিত জমায় ${data.rules.ticketsPerBlock} টিকিট।`
              : `${data.rules.ticketsPerBlock} tickets per ${data.rules.blockAmount} BDT of approved deposits.`}
          </p>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {[
          { key: 'active', label: lang === 'bn' ? 'অ্যাক্টিভ' : 'Active' },
          { key: 'won', label: lang === 'bn' ? 'জিতেছে' : 'Winning' },
          { key: 'used', label: lang === 'bn' ? 'ব্যবহৃত' : 'Used' },
          { key: 'all', label: lang === 'bn' ? 'সব' : 'All' },
        ].map((tp) => (
          <button
            key={tp.key}
            type="button"
            onClick={() => setTab(tp.key as TabKey)}
            className="pill-provider"
            data-active={tab === tp.key}
          >
            {tp.label}
          </button>
        ))}
      </div>

      <Card padding="md">
        {loading ? (
          <p className="text-sm text-ink-mid">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-ink-mid">{lang === 'bn' ? 'এই ক্যাটাগরিতে কোনো টিকিট নেই।' : 'No tickets in this view yet. Approved deposits generate tickets automatically.'}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="text-xs uppercase tracking-wider text-ink-lo">
                <tr>
                  <th className="px-2 py-2 text-left">{lang === 'bn' ? 'নম্বর' : 'Number'}</th>
                  <th className="px-2 py-2 text-left">{lang === 'bn' ? 'উৎস' : 'Source'}</th>
                  <th className="px-2 py-2 text-left">{lang === 'bn' ? 'স্ট্যাটাস' : 'Status'}</th>
                  <th className="px-2 py-2 text-left">{lang === 'bn' ? 'তারিখ' : 'When'}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tk) => (
                  <tr key={tk.id} className="border-t border-neon/10">
                    <td className="px-2 py-2 font-mono text-base font-bold text-gradient-gold">{tk.number}</td>
                    <td className="px-2 py-2 text-xs text-ink-mid">{tk.source}</td>
                    <td className="px-2 py-2"><Chip tone={statusTone(tk.status)}>{tk.status}</Chip></td>
                    <td className="px-2 py-2 text-xs text-ink-lo">{formatDateTime(tk.generatedAt, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
