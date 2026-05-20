'use client';

import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { Home } from 'lucide-react';
import { useState } from 'react';

export default function AdminHomepagePage() {
  const [sections, setSections] = useState({
    hotGames: true,
    slots: true,
    liveCasino: true,
    fishing: true,
    promoStrip: true,
    jackpotTicker: true,
    promoTicker: true,
  });

  return (
    <>
      <PageHeader title="Homepage Content" subtitle="Toggle and reorder sections shown on the homepage" icon={<Home className="h-5 w-5" />} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card padding="lg">
          <CardHeader title="Hero copy (Bangla)" subtitle="Used for first slide" />
          <div className="space-y-3">
            <FormField label="Title">
              <Input defaultValue="আজই খেলুন, জিতুন, আর বোনাস দাবি করুন" />
            </FormField>
            <FormField label="Subtitle">
              <Textarea rows={2} defaultValue="প্রথম ডিপোজিটে পাচ্ছেন বিশেষ অতিরিক্ত বোনাস" />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Primary CTA"><Input defaultValue="এখন রেজিস্টার" /></FormField>
              <FormField label="Secondary CTA"><Input defaultValue="বোনাস দাবি" /></FormField>
            </div>
          </div>
        </Card>

        <Card padding="lg">
          <CardHeader title="Hero copy (English)" subtitle="Used as fallback and EN slide" />
          <div className="space-y-3">
            <FormField label="Title">
              <Input defaultValue="Play smarter, win bigger, claim your bonus" />
            </FormField>
            <FormField label="Subtitle">
              <Textarea rows={2} defaultValue="Special first deposit bonus waiting for new players" />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Primary CTA"><Input defaultValue="Register Now" /></FormField>
              <FormField label="Secondary CTA"><Input defaultValue="Claim Bonus" /></FormField>
            </div>
          </div>
        </Card>

        <Card padding="lg" className="lg:col-span-2">
          <CardHeader title="Section visibility" subtitle="Toggle which homepage blocks render" />
          <div className="grid gap-2 md:grid-cols-2">
            {Object.entries(sections).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between rounded-xl border border-neon/10 bg-base-deep/40 p-3">
                <p className="text-sm capitalize text-ink-hi">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                <Switch checked={value} onChange={(v) => setSections((s) => ({ ...s, [key]: v }))} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-6 flex justify-end">
        <Button>Save Homepage Content</Button>
      </div>
    </>
  );
}
