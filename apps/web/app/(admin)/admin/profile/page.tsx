// Built by Anointed Coder.
'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { FormField, Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { ShieldCheck, Lock, AtSign, Phone, Save, CheckCircle2 } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';
import { formatDateTime } from '@/lib/utils/format';

interface AdminMe {
  id: string;
  username: string;
  phone: string;
  email?: string | null;
  role: { key: string; label: string };
  status: 'active' | 'blocked' | 'pending';
  lastLoginAt?: string | null;
  phoneVerifiedAt?: string | null;
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128),
    confirm: z.string().min(1, 'Please repeat the new password'),
  })
  .refine((d) => d.newPassword === d.confirm, { path: ['confirm'], message: 'Passwords do not match' })
  .refine((d) => d.newPassword !== d.currentPassword, { path: ['newPassword'], message: 'New password must differ from current' });

type PasswordInput = z.infer<typeof passwordSchema>;

export default function AdminProfilePage() {
  const { lang } = useLang();
  const [me, setMe] = useState<AdminMe | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive) return;
        if (data?.user) setMe(data.user as AdminMe);
        else setLoadError('Could not load your profile.');
      })
      .catch(() => { if (alive) setLoadError('Network error while loading your profile.'); });
    return () => { alive = false; };
  }, []);

  return (
    <>
      <PageHeader title="My Profile" subtitle="Account details and password" icon={<ShieldCheck className="h-5 w-5" />} />

      {loadError ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{loadError}</p></Card> : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card tone="elev" padding="lg" className="lg:col-span-1 flex flex-col items-center text-center">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-grad-gold text-2xl font-bold text-base-deep">
            {(me?.username ?? '??').slice(0, 2).toUpperCase()}
          </div>
          <h2 className="mt-4 text-lg font-semibold text-ink-hi">{me?.username ?? '...'}</h2>
          <p className="text-xs text-ink-lo">{me?.role?.label ?? me?.role?.key ?? '...'}</p>
          <div className="mt-3">
            <Chip tone={me?.status === 'active' ? 'ok' : me?.status === 'blocked' ? 'danger' : 'warn'}>
              {me?.status ?? 'unknown'}
            </Chip>
          </div>
        </Card>

        <Card padding="lg" className="lg:col-span-2">
          <CardHeader title="Account Details" subtitle="Read-only summary of your admin account" />
          <dl className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Username" icon={<ShieldCheck className="h-4 w-4" />} value={me?.username ?? '...'} />
            <Field label="Role" icon={<ShieldCheck className="h-4 w-4" />} value={me?.role?.label ?? me?.role?.key ?? '...'} />
            <Field label="Email" icon={<AtSign className="h-4 w-4" />} value={me?.email ?? 'Not set'} />
            <Field label="Phone" icon={<Phone className="h-4 w-4" />} value={me?.phone ?? '...'} />
            <Field label="Account status" icon={<ShieldCheck className="h-4 w-4" />} value={me?.status ?? '...'} />
            <Field
              label="Last login"
              icon={<ShieldCheck className="h-4 w-4" />}
              value={me?.lastLoginAt ? formatDateTime(me.lastLoginAt, lang) : 'No record yet'}
            />
          </dl>
        </Card>
      </div>

      <div className="mt-6">
        <PasswordSection />
      </div>
    </>
  );
}

function Field({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neon/10 bg-base-deep/40 p-3">
      <dt className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-ink-lo">
        {icon}
        <span>{label}</span>
      </dt>
      <dd className="mt-1 truncate text-sm text-ink-hi">{value}</dd>
    </div>
  );
}

function PasswordSection() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordInput>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  });

  const onSubmit = async (values: PasswordInput) => {
    setServerError(null);
    setSuccess(false);
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        setServerError(data.message ?? data.code ?? 'Password change failed');
        return;
      }
      setSuccess(true);
      reset();
      setTimeout(() => setSuccess(false), 2500);
    } catch {
      setServerError('Could not reach the server');
    }
  };

  return (
    <Card padding="lg">
      <CardHeader
        title="Change Password"
        subtitle="Rotate your password after first login and any time you suspect it is compromised"
      />
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <FormField label="Current password" required error={errors.currentPassword?.message}>
          <Input
            type="password"
            autoComplete="current-password"
            leftIcon={<Lock className="h-4 w-4" />}
            {...register('currentPassword')}
            invalid={!!errors.currentPassword}
          />
        </FormField>
        <div className="grid gap-3 md:grid-cols-2">
          <FormField label="New password" required error={errors.newPassword?.message} hint="At least 8 characters.">
            <Input
              type="password"
              autoComplete="new-password"
              leftIcon={<Lock className="h-4 w-4" />}
              {...register('newPassword')}
              invalid={!!errors.newPassword}
            />
          </FormField>
          <FormField label="Confirm new password" required error={errors.confirm?.message}>
            <Input
              type="password"
              autoComplete="new-password"
              leftIcon={<Lock className="h-4 w-4" />}
              {...register('confirm')}
              invalid={!!errors.confirm}
            />
          </FormField>
        </div>

        {serverError ? <p className="text-sm text-signal-danger">{serverError}</p> : null}
        {success ? (
          <p className="inline-flex items-center gap-2 text-sm text-neon">
            <CheckCircle2 className="h-4 w-4" /> Password updated. Other sessions have been signed out.
          </p>
        ) : null}

        <div className="flex justify-end">
          <Button type="submit" loading={isSubmitting} leftIcon={<Save className="h-4 w-4" />}>
            Save new password
          </Button>
        </div>
      </form>
    </Card>
  );
}
