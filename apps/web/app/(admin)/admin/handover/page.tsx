// Built by Anointed Coder.
'use client';

import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { BRAND } from '@/lib/constants/brand';
import { FileKey2, Download, Send, MessageCircle, CheckCircle2, AlertTriangle } from 'lucide-react';

const CHECKLIST = [
  'Complete monorepo source: web, admin, and the mobile app',
  'Live web platform: Next.js, PostgreSQL, PM2, Nginx, Cloudflare',
  'Admin panel controlling banners, games, promotions, payments and more',
  'Native Android app (React Native and Expo), matching the website',
  'Player push notifications wired end to end',
  'One-command VPS deploy script (scripts/deploy.sh)',
  'Prisma schema with the db push workflow',
  'Nightly database and uploads backup',
  'Environment variables example file',
  'Full handover document (docs/HANDOVER.md)',
  'Deployment, backup, provider, and admin guides',
  'Seeded super-admin account',
];

const PENDING_FROM_CLIENT = [
  'Transfer the GitHub repo, Expo project, and Firebase project to the owner (docs/HANDOVER.md section 2)',
  'Hand over the VPS, Cloudflare, and domain accounts, then rotate the server root password',
  'Confirm SECRETS_KEY and CRON_SECRET are set in the server env',
  'Enter live payment gateway credentials in Admin, Payments',
  'Configure a live SMS or OTP provider in Admin, Notifications',
  'Enter game provider API credentials in Admin, Providers',
  'Rotate the Telegram bot token and the cron secret',
  'Delete the test accounts pasha_m_test and pasha_tg_test',
  'Publish the latest app build via Admin, Settings, App Download',
];

export default function AdminHandoverPage() {
  return (
    <>
      <PageHeader title="Source Handover" subtitle="Everything needed for a clean transfer to the client" icon={<FileKey2 className="h-5 w-5" />} />

      <Card padding="lg" tone="gold" className="mb-6">
        <h2 className="text-base font-semibold text-ink-hi">{BRAND.developer.label}</h2>
        <p className="mt-1 text-sm text-ink-mid">
          Lead developer: {BRAND.developer.name} · <a href={`mailto:${BRAND.developer.email}`} className="hover:text-ink-hi">{BRAND.developer.email}</a>
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={BRAND.developer.telegram} target="_blank" rel="noreferrer">
            <Button variant="neon" leftIcon={<Send className="h-4 w-4" />}>Telegram</Button>
          </a>
          <a href={BRAND.developer.whatsapp} target="_blank" rel="noreferrer">
            <Button variant="neon" leftIcon={<MessageCircle className="h-4 w-4" />}>WhatsApp</Button>
          </a>
          <a href={`mailto:${BRAND.developer.email}`}>
            <Button variant="ghost">Email</Button>
          </a>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card padding="lg">
          <CardHeader title="Handover Checklist" subtitle="Delivered in this build" />
          <ul className="space-y-2">
            {CHECKLIST.map((c) => (
              <li key={c} className="flex items-center gap-3 rounded-xl border border-neon/10 bg-base-deep/40 px-3 py-2 text-sm">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-neon/15 text-neon">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <span className="text-ink-hi">{c}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card padding="lg">
          <CardHeader title="Pending at Handover" subtitle="Actions to complete the transfer and launch" />
          <ul className="space-y-2">
            {PENDING_FROM_CLIENT.map((p) => (
              <li key={p} className="flex items-start gap-3 rounded-xl border border-gold-500/20 bg-gold-500/5 px-3 py-2 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold-300" />
                <span className="text-ink-mid">{p}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card padding="lg" className="lg:col-span-2">
          <CardHeader title="Deliverables Ready" subtitle="Quick links to handover documents" />
          <div className="grid gap-3 sm:grid-cols-3">
            {['Milestones plan', 'Testing checklist', 'API plan', 'Deployment guide', 'Backup guide', 'Source archive'].map((d) => (
              <Button key={d} variant="neon" leftIcon={<Download className="h-4 w-4" />}>{d}</Button>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
