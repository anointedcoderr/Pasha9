'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { FormField, Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { Button } from '@/components/ui/Button';
import { ShieldCheck, Lock, Smartphone, History } from 'lucide-react';
import { formatDateTime } from '@/lib/utils/format';
import { useLang } from '@/lib/i18n/context';

export default function SecurityPage() {
  const { lang } = useLang();
  const [twoFa, setTwoFa] = useState(true);
  const [loginAlerts, setLoginAlerts] = useState(true);
  const [withdrawConfirm, setWithdrawConfirm] = useState(false);

  return (
    <>
      <PageHeader title="Security" subtitle="Keep your account protected" icon={<ShieldCheck className="h-5 w-5" />} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card padding="lg">
          <CardHeader title="Password" subtitle="Change your account password" />
          <form className="space-y-3">
            <FormField label="Current password" required>
              <Input type="password" leftIcon={<Lock className="h-4 w-4" />} placeholder="••••••••" />
            </FormField>
            <FormField label="New password" required>
              <Input type="password" leftIcon={<Lock className="h-4 w-4" />} placeholder="At least 8 characters" />
            </FormField>
            <FormField label="Confirm new password" required>
              <Input type="password" leftIcon={<Lock className="h-4 w-4" />} placeholder="Repeat new password" />
            </FormField>
            <Button type="button">Update password</Button>
          </form>
        </Card>

        <Card padding="lg">
          <CardHeader title="Login & Withdrawal Protection" subtitle="Toggle account-wide guards" />
          <div className="space-y-3">
            <Row label="Two-factor auth" hint="Require a code from your authenticator on every login." value={twoFa} onChange={setTwoFa} />
            <Row label="Login alert messages" hint="Receive a notification each time the account is accessed." value={loginAlerts} onChange={setLoginAlerts} />
            <Row label="Confirm every withdrawal by SMS" hint="Add an SMS challenge before any withdrawal request." value={withdrawConfirm} onChange={setWithdrawConfirm} />
          </div>
        </Card>

        <Card padding="lg" className="lg:col-span-2">
          <CardHeader title="Recent device activity" subtitle="Sessions from the last 7 days" />
          <ul className="divide-y divide-neon/10">
            {[
              { device: 'Android Chrome', ip: '103.218.x.x', loc: 'Dhaka, BD', when: Date.now() - 3600_000 },
              { device: 'iPhone Safari', ip: '103.218.x.x', loc: 'Dhaka, BD', when: Date.now() - 86400_000 },
              { device: 'Windows Edge', ip: '103.45.x.x', loc: 'Chattogram, BD', when: Date.now() - 3 * 86400_000 },
            ].map((s, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-neon/15 bg-base-deep/40 text-neon">
                    {s.device.includes('Android') || s.device.includes('iPhone') ? <Smartphone className="h-4 w-4" /> : <History className="h-4 w-4" />}
                  </span>
                  <div>
                    <p className="text-ink-hi">{s.device}</p>
                    <p className="text-xs text-ink-lo">{s.loc} | {s.ip}</p>
                  </div>
                </div>
                <p className="text-xs text-ink-lo">{formatDateTime(s.when, lang)}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

function Row({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-neon/10 bg-base-deep/40 p-3">
      <div>
        <p className="text-sm font-medium text-ink-hi">{label}</p>
        <p className="text-xs text-ink-mid">{hint}</p>
      </div>
      <Switch checked={value} onChange={onChange} />
    </div>
  );
}
