// Built by Anointed Coder.
//
// Security Center. M1 surfaces what is already implemented honestly:
// bcrypt hashing, JWT cookies, rate-limited auth endpoints, session
// revocation on logout/refresh. Everything else (2FA, IP block, login
// alerts, suspicious-activity detection) is clearly marked as Ready
// for M2 since it needs a provider or extra schema.

'use client';

import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { ShieldCheck, Lock, KeyRound, Smartphone, Wifi, AlertOctagon, Bell, History, Network } from 'lucide-react';

interface Row {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  status: 'live' | 'm2' | 'provider';
}

const ROWS: Row[] = [
  {
    icon: Lock,
    title: 'Password hashing',
    body: 'bcrypt cost 12 on every register / password change. Already live.',
    status: 'live',
  },
  {
    icon: KeyRound,
    title: 'Session tokens',
    body: 'JWT access cookie (8h) + 30-day refresh cookie with DB-tracked sessions. Refresh rotates the secret on every renewal and revokes the previous session row.',
    status: 'live',
  },
  {
    icon: Bell,
    title: 'Login alerts (email / SMS)',
    body: 'Each successful login already writes to ActivityLog. Notifying the user out-of-band needs the M2 email / SMS provider hookup.',
    status: 'provider',
  },
  {
    icon: Smartphone,
    title: 'Two-factor (TOTP)',
    body: 'OtpCode schema is already in place. Enforcing TOTP at login + UI to enrol the secret ships in M2 alongside the SMS provider.',
    status: 'm2',
  },
  {
    icon: Wifi,
    title: 'IP block list',
    body: 'Schema addition + middleware check. M2 deliverable.',
    status: 'm2',
  },
  {
    icon: AlertOctagon,
    title: 'Suspicious activity heuristics',
    body: 'Velocity rules on deposit / withdraw / login flag-and-hold. M2 deliverable, depends on the M2 reports cohort engine.',
    status: 'm2',
  },
  {
    icon: History,
    title: 'Login history per user',
    body: 'Activity log records every USER_LOGIN; the user dashboard already shows recent device activity. A per-user filtered view in admin ships in M2.',
    status: 'm2',
  },
  {
    icon: Network,
    title: 'Brute-force protection',
    body: 'Per-IP rate limit on login / register / reset / OTP. Already live (10 attempts / 60s).',
    status: 'live',
  },
];

function chipFor(status: Row['status']) {
  if (status === 'live') return <Chip tone="ok">Live</Chip>;
  if (status === 'provider') return <Chip tone="warn">Requires provider</Chip>;
  return <Chip tone="info">Ready for M2</Chip>;
}

export default function AdminSecurityPage() {
  return (
    <>
      <PageHeader
        title="Security Center"
        subtitle="Live protections + the M2 / provider-gated roadmap"
        icon={<ShieldCheck className="h-5 w-5" />}
      />

      <Card padding="md" className="mb-4">
        <p className="text-xs text-ink-mid">
          This page shows the current state of every security-related control on the platform. Items marked
          <span className="mx-1 inline-flex items-center"><Chip tone="ok">Live</Chip></span>
          are enforced in M1. Items marked
          <span className="mx-1 inline-flex items-center"><Chip tone="info">Ready for M2</Chip></span>
          have the schema or call site reserved and ship in Milestone 2. Items marked
          <span className="mx-1 inline-flex items-center"><Chip tone="warn">Requires provider</Chip></span>
          depend on the client supplying an SMS / email / IP-intel provider key first.
        </p>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {ROWS.map((r) => {
          const Icon = r.icon;
          return (
            <Card key={r.title} padding="lg">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-500/10 text-gold-300">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-extrabold text-ink-hi">{r.title}</p>
                    {chipFor(r.status)}
                  </div>
                  <p className="mt-1 text-xs leading-snug text-ink-mid">{r.body}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
