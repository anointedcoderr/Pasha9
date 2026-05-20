'use client';

import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { BRAND } from '@/lib/constants/brand';
import { FileKey2, Download, Send, MessageCircle, CheckCircle2, AlertTriangle } from 'lucide-react';

const CHECKLIST = [
  'Source code archive prepared',
  'Database schema documented',
  'API endpoint plan delivered',
  'Environment variables example file',
  'Deployment guide for VPS',
  'Backup and restore guide',
  'Domain and DNS instructions',
  'Frontend hosting setup (Vercel or VPS)',
  'PostgreSQL instance configured',
  'Storage and CDN setup',
  'Game provider API ready connections',
  'Payment gateway configuration placeholder',
  'Android APK build with Capacitor',
  'Admin and user test accounts',
  'Final smoke testing report',
];

const PENDING_FROM_CLIENT = [
  'Final brand name to replace sanjid14',
  'Approved logo and color refinements',
  'Real game provider API credentials',
  'Selected payment gateway documentation',
  'Approved KYC document list',
  'Production VPS / Vercel access',
  'Domain name and DNS access',
  'Telegram and WhatsApp accounts for live support',
];

export default function AdminHandoverPage() {
  return (
    <>
      <PageHeader title="Source Handover" subtitle="Everything needed for a clean transfer to the client" icon={<FileKey2 className="h-5 w-5" />} />

      <Card padding="lg" tone="gold" className="mb-6">
        <h2 className="text-base font-semibold text-ink-hi">{BRAND.builtBy}</h2>
        <p className="mt-1 text-sm text-ink-mid">
          Lead developer: {BRAND.builderName} · <a href={`mailto:${BRAND.builderEmail}`} className="hover:text-ink-hi">{BRAND.builderEmail}</a>
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={BRAND.telegram} target="_blank" rel="noreferrer">
            <Button variant="neon" leftIcon={<Send className="h-4 w-4" />}>Telegram</Button>
          </a>
          <a href={BRAND.whatsapp} target="_blank" rel="noreferrer">
            <Button variant="neon" leftIcon={<MessageCircle className="h-4 w-4" />}>WhatsApp</Button>
          </a>
          <a href={`mailto:${BRAND.builderEmail}`}>
            <Button variant="ghost">Email</Button>
          </a>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card padding="lg">
          <CardHeader title="Handover Checklist" subtitle="Mark each item as Milestone 2 and 3 complete" />
          <ul className="space-y-2">
            {CHECKLIST.map((c, i) => (
              <li key={c} className="flex items-center gap-3 rounded-xl border border-neon/10 bg-base-deep/40 px-3 py-2 text-sm">
                <span className={`flex h-6 w-6 items-center justify-center rounded-md ${i < 4 ? 'bg-neon/15 text-neon' : 'bg-base-elev text-ink-lo'}`}>
                  {i < 4 ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                </span>
                <span className={i < 4 ? 'text-ink-hi' : 'text-ink-mid'}>{c}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card padding="lg">
          <CardHeader title="Pending from Client" subtitle="Items required before Milestone 2 and 3 wrap up" />
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
