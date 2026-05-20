'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Logo } from '@/components/site/Logo';
import { FormField, Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { BRAND } from '@/lib/constants/brand';
import { useT } from '@/lib/i18n/context';
import { Lock, ShieldCheck, User as UserIcon } from 'lucide-react';

export default function AdminLoginPage() {
  const t = useT();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <div className="font-admin relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[110%] -translate-x-1/2 rounded-full bg-grad-radial-glow blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-base-deep via-base-deep/40 to-transparent" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="card-glow p-8 ring-gold-soft">
          <div className="mb-6 flex items-center justify-between">
            <Logo />
            <span className="inline-flex items-center gap-1.5 rounded-pill border border-neon/30 bg-neon/10 px-3 py-1 text-[10px] uppercase tracking-wider text-neon">
              <ShieldCheck className="h-3 w-3" /> Admin
            </span>
          </div>
          <h1 className="text-2xl font-bold text-gradient-gold">{t('admin.loginTitle')}</h1>
          <p className="mt-1 text-sm text-ink-mid">{t('admin.loginSub')}</p>

          <form
            className="mt-6 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setLoading(true);
              await new Promise((r) => setTimeout(r, 600));
              setLoading(false);
              router.push('/admin');
            }}
          >
            <FormField label={t('admin.username')} required>
              <Input leftIcon={<UserIcon className="h-4 w-4" />} placeholder="admin.username" defaultValue="admin.rafiq" />
            </FormField>
            <FormField label={t('admin.password')} required>
              <Input type="password" leftIcon={<Lock className="h-4 w-4" />} placeholder="••••••••" defaultValue="demo-admin" />
            </FormField>
            <Button full type="submit" size="lg" loading={loading}>
              {t('admin.loginBtn')}
            </Button>
          </form>

          <div className="mt-6 border-t border-neon/10 pt-4 text-center text-[11px] text-ink-lo">
            <p>{BRAND.builtBy}</p>
            <p className="mt-1">
              <a href={`mailto:${BRAND.builderEmail}`} className="hover:text-ink-hi">{BRAND.builderEmail}</a>
            </p>
            <p className="mt-3">
              <Link href="/" className="text-ink-mid hover:text-ink-hi">← Back to site</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
