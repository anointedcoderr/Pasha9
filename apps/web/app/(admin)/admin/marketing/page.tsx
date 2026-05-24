// Built by Anointed Coder.
//
// Marketing Center scaffolding. M1 lets the admin manage what is
// already live (banners, popups, promo text, affiliate). Promo
// codes, push notifications, SMS / email blasts and cashback
// campaigns are scaffolded as Ready for M2 with honest copy.

'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import {
  Megaphone,
  Image as ImageIcon,
  Type,
  Briefcase,
  Network,
  Gift,
  Tag,
  Bell,
  MessageSquare,
  TrendingUp,
} from 'lucide-react';

const LIVE = [
  { href: '/admin/banners', icon: ImageIcon, title: 'Banners & Hero Slides', body: 'Image or video; admin chooses media type, poster fallback, auto-rotation and CTA.' },
  { href: '/admin/popups', icon: Megaphone, title: 'Announcement Popups', body: 'First-visit popup carousel; cookie-gated so it does not annoy returning visitors.' },
  { href: '/admin/promo-text', icon: Type, title: 'Promo Marquee Text', body: 'Rolling promo strip below the hero. Multi-line, bn / en aware.' },
  { href: '/admin/bonuses', icon: Gift, title: 'Bonus Rules', body: 'Define percent / fixed bonus rules with min deposit, max bonus and turnover requirement.' },
  { href: '/admin/affiliate', icon: Briefcase, title: 'Affiliate Program', body: 'Approve applications, manage commission tiers, review the affiliate roster.' },
  { href: '/admin/referrals', icon: Network, title: 'Referral System', body: 'Three-level referral chain reporting (data live; commission accrual M2).' },
];

const M2 = [
  { icon: Tag, title: 'Promo codes', body: 'Single-use and multi-use promo codes that grant bonus rules on redemption. New schema + admin CRUD.' },
  { icon: Bell, title: 'Push notifications', body: 'Web push with VAPID; segments by activity. Requires VAPID keys + service worker registration.' },
  { icon: MessageSquare, title: 'SMS / Email blasts', body: 'Bulk send via provider adapter (BulkSMS / SendGrid / similar). Provider keys required.' },
  { icon: TrendingUp, title: 'Cashback campaigns', body: 'Periodic cashback engine that credits a percentage of net loss to bonus balance. Wired against the same Transaction ledger.' },
];

export default function AdminMarketingPage() {
  return (
    <>
      <PageHeader
        title="Marketing Center"
        subtitle="Banners, popups, bonuses, affiliate + the M2 roadmap"
        icon={<Megaphone className="h-5 w-5" />}
      />

      <Card padding="md" className="mb-4">
        <p className="text-xs text-ink-mid">
          Live channels are wired to the public site today. Items marked
          <span className="mx-1 inline-flex items-center"><Chip tone="warn">Ready for M2</Chip></span>
          either need a provider key (push, SMS, email) or a small schema addition (promo codes, cashback
          engine) and ship in Milestone 2.
        </p>
      </Card>

      <CardHeader title="Live now" />
      <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {LIVE.map((r) => {
          const Icon = r.icon;
          return (
            <Link key={r.title} href={r.href} className="card-glow group flex flex-col gap-2 p-4 transition hover:ring-1 hover:ring-gold-500/30">
              <div className="flex items-center justify-between gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold-500/10 text-gold-300">
                  <Icon className="h-4 w-4" />
                </span>
                <Chip tone="ok">Live</Chip>
              </div>
              <p className="text-sm font-extrabold text-ink-hi">{r.title}</p>
              <p className="text-xs text-ink-mid">{r.body}</p>
              <span className="mt-auto text-[11px] font-semibold text-gold-300 group-hover:text-ink-hi">Open →</span>
            </Link>
          );
        })}
      </div>

      <div className="mt-6">
        <CardHeader title="Ready for M2" />
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {M2.map((r) => {
          const Icon = r.icon;
          return (
            <Card key={r.title} padding="lg" className="border-dashed">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-base-deep/60 text-ink-lo">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-extrabold text-ink-hi">{r.title}</p>
                    <Chip tone="warn">Ready for M2</Chip>
                  </div>
                  <p className="mt-1 text-xs text-ink-mid">{r.body}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
