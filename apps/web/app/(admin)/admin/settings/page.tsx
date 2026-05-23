// Built by Anointed Coder.
'use client';

import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { FormField, Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { Button } from '@/components/ui/Button';
import { Settings, ShieldAlert } from 'lucide-react';
import { BRAND } from '@/lib/constants/brand';
import { useState } from 'react';

export default function AdminSettingsPage() {
  const [maintenance, setMaintenance] = useState(false);
  const [signupOpen, setSignupOpen] = useState(true);
  const [minDeposit, setMinDeposit] = useState(500);

  return (
    <>
      <PageHeader title="System Settings" subtitle="Platform wide configuration" icon={<Settings className="h-5 w-5" />} />

      <Card padding="lg" tone="gold" className="mb-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-base-deep text-gold-300"><ShieldAlert className="h-5 w-5" /></span>
          <div>
            <h2 className="text-base font-semibold text-ink-hi">Compliance Notice</h2>
            <p className="mt-1 text-sm text-ink-mid">
              The platform is built as a technical product only. The site owner is responsible for obtaining the appropriate license, complying with local laws, securing payment provider approval, satisfying KYC requirements, and signing the necessary agreements with each game provider before any public launch. {BRAND.developer.label}.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card padding="lg">
          <CardHeader title="General" />
          <div className="space-y-3">
            <FormField label="Site name"><Input defaultValue={BRAND.display} /></FormField>
            <FormField label="Default language"><Input defaultValue="Bangla" /></FormField>
            <FormField label="Currency"><Input defaultValue="BDT" /></FormField>
          </div>
        </Card>

        <Card padding="lg">
          <CardHeader title="Operations" />
          <div className="space-y-3">
            <Row label="Maintenance mode" hint="Pause all gameplay across the platform" value={maintenance} onChange={setMaintenance} />
            <Row label="New signup open" hint="Allow new user registrations" value={signupOpen} onChange={setSignupOpen} />
            <FormField label="Minimum deposit (BDT)"><Input type="number" value={minDeposit} onChange={(e) => setMinDeposit(Number(e.target.value) || 0)} /></FormField>
            <FormField label="Minimum withdrawal (BDT)"><Input type="number" defaultValue={500} /></FormField>
          </div>
        </Card>

        <Card padding="lg">
          <CardHeader title="Public Support Contacts" subtitle="What players see in the footer, support page and floating contact button. Leave empty to hide a channel." />
          <div className="space-y-3">
            <FormField label="Telegram link"><Input placeholder="https://t.me/your-channel" /></FormField>
            <FormField label="WhatsApp link"><Input placeholder="https://wa.me/8801XXXXXXXXX" /></FormField>
            <FormField label="Support email"><Input placeholder="support@pasha9.com" /></FormField>
          </div>
        </Card>

        <Card padding="lg">
          <CardHeader title="Internal demo games" subtitle="Defaults for any internal demo titles. Real money games must go through licensed provider APIs." />
          <div className="space-y-3">
            <FormField label="Default house edge (%)"><Input type="number" defaultValue={3} step={0.1} /></FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Default min bet"><Input type="number" defaultValue={10} /></FormField>
              <FormField label="Default max bet"><Input type="number" defaultValue={5000} /></FormField>
            </div>
            <FormField label="Risk level"><Input defaultValue="medium" /></FormField>
          </div>
        </Card>

        <Card padding="lg">
          <CardHeader title="Mobile App (APK)" subtitle="Visible on the homepage app strip and the public /apk page." />
          <div className="space-y-3">
            <FormField label="APK download URL" hint="External link or /uploads/apk/...apk">
              <Input placeholder="https://pasha9.com/uploads/apk/pasha9.apk" />
            </FormField>
            <FormField label="APK version" hint="Shown next to the Download button">
              <Input placeholder="1.0.0" />
            </FormField>
          </div>
        </Card>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-neon/10 pt-4 text-xs text-ink-lo">
        <span>{BRAND.developer.label} · <a href={`mailto:${BRAND.developer.email}`} className="hover:text-ink-hi">{BRAND.developer.email}</a></span>
        <Button>Save Settings</Button>
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
