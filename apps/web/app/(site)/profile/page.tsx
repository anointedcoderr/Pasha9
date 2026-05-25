'use client';

import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { FormField, Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useMe } from '@/lib/hooks/useMe';
import { User as UserIcon, Phone, AtSign, Globe2, Save } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function ProfilePage() {
  const [saving, setSaving] = useState(false);
  const { me, loading } = useMe();

  // Local form state, re-seeded whenever the live user resolves so the
  // visitor sees their actual identity on this page (not a mock user).
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [language, setLanguage] = useState('');

  useEffect(() => {
    if (!me) return;
    setUsername(me.username);
    setPhone(me.phone);
    setEmail(me.email ?? '');
    setLanguage(me.language === 'bn' ? 'Bangla' : 'English');
  }, [me]);

  const initials = (me?.username ?? '..').slice(0, 2).toUpperCase();
  const memberSince = me?.lastLoginAt
    ? new Date(me.lastLoginAt).getFullYear()
    : null;

  return (
    <>
      <PageHeader title="Profile" subtitle="Manage your account information" icon={<UserIcon className="h-5 w-5" />} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card tone="elev" className="lg:col-span-1 flex flex-col items-center text-center" padding="lg">
          <div className="relative">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-grad-gold text-2xl font-bold text-base-deep">
              {initials}
            </div>
            <span className="absolute -bottom-1 right-0 flex h-7 w-7 items-center justify-center rounded-full border border-base-deep bg-neon text-base-deep">
              <Save className="h-3.5 w-3.5" />
            </span>
          </div>
          <h2 className="mt-4 text-lg font-semibold text-ink-hi">{loading ? '...' : me?.username ?? 'Guest'}</h2>
          <p className="text-xs text-ink-lo">{me?.phone ?? ''}</p>
          <div className="mt-4 grid w-full grid-cols-2 gap-2 text-left">
            <Card padding="sm" className="text-xs">
              <p className="text-ink-lo">Last seen</p>
              <p className="mt-1 text-ink-hi">{memberSince ?? '-'}</p>
            </Card>
            <Card padding="sm" className="text-xs">
              <p className="text-ink-lo">Country</p>
              <p className="mt-1 text-ink-hi">{me?.country ?? '-'}</p>
            </Card>
          </div>
        </Card>

        <Card className="lg:col-span-2" padding="lg">
          <CardHeader title="Personal Information" subtitle="Used for account verification only. Edit + save ships in M2." />
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();
              setSaving(true);
              await new Promise((r) => setTimeout(r, 600));
              setSaving(false);
            }}
          >
            <FormField label="Username">
              <Input value={username} onChange={(e) => setUsername(e.target.value)} leftIcon={<UserIcon className="h-4 w-4" />} disabled />
            </FormField>
            <FormField label="Phone">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} leftIcon={<Phone className="h-4 w-4" />} disabled />
            </FormField>
            <FormField label="Email">
              <Input value={email} onChange={(e) => setEmail(e.target.value)} leftIcon={<AtSign className="h-4 w-4" />} placeholder="optional" disabled />
            </FormField>
            <FormField label="Language">
              <Input value={language} onChange={(e) => setLanguage(e.target.value)} leftIcon={<Globe2 className="h-4 w-4" />} disabled />
            </FormField>
            <div className="md:col-span-2">
              <Button type="submit" loading={saving} leftIcon={<Save className="h-4 w-4" />} disabled>
                Save Changes
              </Button>
              <p className="mt-2 text-[11px] text-ink-lo">Inline profile edits ship in Milestone 2.</p>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
