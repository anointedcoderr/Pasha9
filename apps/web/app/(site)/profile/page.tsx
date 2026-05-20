'use client';

import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { FormField, Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { currentUser } from '@/lib/mock/users';
import { User as UserIcon, Phone, AtSign, Globe2, Save } from 'lucide-react';
import { useState } from 'react';

export default function ProfilePage() {
  const [saving, setSaving] = useState(false);
  return (
    <>
      <PageHeader title="Profile" subtitle="Manage your account information" icon={<UserIcon className="h-5 w-5" />} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card tone="elev" className="lg:col-span-1 flex flex-col items-center text-center" padding="lg">
          <div className="relative">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-grad-gold text-2xl font-bold text-base-deep">
              {currentUser.username.slice(0, 2).toUpperCase()}
            </div>
            <span className="absolute -bottom-1 right-0 flex h-7 w-7 items-center justify-center rounded-full border border-base-deep bg-neon text-base-deep">
              <Save className="h-3.5 w-3.5" />
            </span>
          </div>
          <h2 className="mt-4 text-lg font-semibold text-ink-hi">{currentUser.username}</h2>
          <p className="text-xs text-ink-lo">{currentUser.phone}</p>
          <div className="mt-4 grid w-full grid-cols-2 gap-2 text-left">
            <Card padding="sm" className="text-xs">
              <p className="text-ink-lo">Member since</p>
              <p className="mt-1 text-ink-hi">{new Date(currentUser.createdAt).getFullYear()}</p>
            </Card>
            <Card padding="sm" className="text-xs">
              <p className="text-ink-lo">Country</p>
              <p className="mt-1 text-ink-hi">{currentUser.country}</p>
            </Card>
          </div>
        </Card>

        <Card className="lg:col-span-2" padding="lg">
          <CardHeader title="Personal Information" subtitle="Used for account verification only" />
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
              <Input defaultValue={currentUser.username} leftIcon={<UserIcon className="h-4 w-4" />} />
            </FormField>
            <FormField label="Phone">
              <Input defaultValue={currentUser.phone} leftIcon={<Phone className="h-4 w-4" />} />
            </FormField>
            <FormField label="Email">
              <Input defaultValue={currentUser.email} leftIcon={<AtSign className="h-4 w-4" />} placeholder="optional" />
            </FormField>
            <FormField label="Language">
              <Input defaultValue={currentUser.language === 'bn' ? 'Bangla' : 'English'} leftIcon={<Globe2 className="h-4 w-4" />} />
            </FormField>
            <div className="md:col-span-2">
              <Button type="submit" loading={saving} leftIcon={<Save className="h-4 w-4" />}>
                Save Changes
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
