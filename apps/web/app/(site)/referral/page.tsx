'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { mockReferralChain, referralCode, referralLink, referralStats } from '@/lib/mock/referrals';
import { Users, Copy, Check, Share2, ArrowRight } from 'lucide-react';
import { useT, useLang } from '@/lib/i18n/context';
import { formatBDT, formatDate } from '@/lib/utils/format';
import { Button } from '@/components/ui/Button';

export default function ReferralPage() {
  const t = useT();
  const { lang } = useLang();
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (value: string, key: string) => {
    if (typeof navigator !== 'undefined') {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600);
    }
  };

  return (
    <>
      <PageHeader title={t('referral.title')} subtitle={t('referral.subtitle')} icon={<Users className="h-5 w-5" />} />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="card-glow space-y-5 p-6 lg:col-span-2">
          <div className="grid gap-4 md:grid-cols-2">
            <CopyField label={t('referral.code')} value={referralCode} onCopy={() => copy(referralCode, 'code')} copied={copied === 'code'} />
            <CopyField label={t('referral.link')} value={referralLink} onCopy={() => copy(referralLink, 'link')} copied={copied === 'link'} />
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label={t('referral.totalInvited')} value={referralStats.totalInvited.toString()} />
            <Stat label={t('referral.totalEarned')} value={formatBDT(referralStats.totalEarned)} accent />
            <Stat label={t('referral.pending')} value={formatBDT(referralStats.pending)} />
            <Stat label={t('referral.claimed')} value={formatBDT(referralStats.claimed)} accent />
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-ink-hi">{t('referral.levels')}</h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { key: 'level1', rate: '8%' },
                { key: 'level2', rate: '4%' },
                { key: 'level3', rate: '2%' },
              ].map((lvl) => (
                <div key={lvl.key} className="rounded-xl border border-neon/15 bg-base-deep/40 p-4">
                  <p className="text-xs uppercase tracking-wider text-ink-lo">{t(`referral.${lvl.key}`)}</p>
                  <p className="mt-1 text-xl font-bold text-gradient-gold">{lvl.rate}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card-glow p-6">
          <h3 className="text-sm font-semibold text-ink-hi">Share with</h3>
          <p className="mt-1 text-xs text-ink-lo">Pick a channel and one-tap invite friends.</p>
          <div className="mt-4 space-y-2">
            {['WhatsApp', 'Telegram', 'Facebook', 'SMS', 'Email'].map((ch) => (
              <button key={ch} className="flex w-full items-center justify-between rounded-xl border border-neon/15 bg-base-deep/40 px-3 py-2 text-sm text-ink-hi hover:border-neon/40">
                <span className="inline-flex items-center gap-2">
                  <Share2 className="h-4 w-4 text-neon" /> {ch}
                </span>
                <ArrowRight className="h-4 w-4 text-ink-lo" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <section className="card-glow mt-8 p-6">
        <h2 className="text-lg font-semibold text-ink-hi">{t('referral.chainTitle')}</h2>
        <p className="mt-1 text-sm text-ink-lo">Three-level visualization of your active downline.</p>
        <ChainView />
      </section>

      <section className="card-glow mt-6 overflow-hidden p-0">
        <div className="border-b border-neon/10 px-6 py-4">
          <h3 className="text-sm font-semibold text-ink-hi">Latest referrals</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-neon/10 bg-base-deep/40 text-xs uppercase tracking-wider text-ink-lo">
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Level</th>
                <th className="px-4 py-3 text-left">Joined</th>
                <th className="px-4 py-3 text-left">Earned</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {mockReferralChain.map((r) => (
                <tr key={r.id} className="table-row">
                  <td className="px-4 py-3 text-ink-hi">{r.referredUsername}</td>
                  <td className="px-4 py-3 text-ink-mid">L{r.level}</td>
                  <td className="px-4 py-3 text-ink-lo">{formatDate(r.createdAt, lang)}</td>
                  <td className="px-4 py-3 text-gradient-gold">{formatBDT(r.earned)}</td>
                  <td className="px-4 py-3">
                    <span className={r.status === 'active' ? 'chip chip-ok' : 'chip chip-warn'}>{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function CopyField({ label, value, onCopy, copied }: { label: string; value: string; onCopy: () => void; copied: boolean }) {
  return (
    <div>
      <p className="mb-2 text-xs uppercase tracking-wider text-ink-lo">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate rounded-xl border border-neon/15 bg-base-deep/60 px-3 py-2.5 font-mono text-sm text-ink-hi">
          {value}
        </code>
        <Button size="md" variant="neon" onClick={onCopy} leftIcon={copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-neon/10 bg-base-deep/40 p-4">
      <p className="text-[11px] uppercase tracking-wider text-ink-lo">{label}</p>
      <p className={accent ? 'mt-1 text-lg font-bold text-gradient-gold' : 'mt-1 text-lg font-bold text-ink-hi'}>{value}</p>
    </div>
  );
}

function ChainView() {
  const l1 = mockReferralChain.filter((r) => r.level === 1).slice(0, 4);
  const l2 = mockReferralChain.filter((r) => r.level === 2).slice(0, 6);
  const l3 = mockReferralChain.filter((r) => r.level === 3).slice(0, 6);

  return (
    <div className="mt-5 space-y-6">
      <Level label="Level 1 · 8%" items={l1.map((u) => u.referredUsername)} tone="gold" />
      <Level label="Level 2 · 4%" items={l2.map((u) => u.referredUsername)} tone="neon" />
      <Level label="Level 3 · 2%" items={l3.map((u) => u.referredUsername)} tone="cool" />
    </div>
  );
}

function Level({ label, items, tone }: { label: string; items: string[]; tone: 'gold' | 'neon' | 'cool' }) {
  const ringMap = { gold: 'ring-gold-soft', neon: 'ring-neon-soft', cool: 'border-neon/15' } as const;
  return (
    <div>
      <p className="mb-2 text-xs uppercase tracking-wider text-ink-lo">{label}</p>
      <div className="flex flex-wrap gap-2">
        {items.length === 0 ? <span className="text-sm text-ink-lo">No referrals at this level yet.</span> : null}
        {items.map((u) => (
          <span key={u} className={`inline-flex items-center gap-2 rounded-xl border border-neon/10 bg-base-deep/40 px-3 py-2 text-sm ${ringMap[tone]}`}>
            <span className="h-2 w-2 rounded-full bg-neon" />
            {u}
          </span>
        ))}
      </div>
    </div>
  );
}
