'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/Input';
import { Phone, Lock, KeyRound, UserPlus } from 'lucide-react';
import { loginSchema, signupSchema, type LoginInput, type SignupInput } from '@/lib/utils/validation';
import { useT } from '@/lib/i18n/context';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialTab?: 'login' | 'signup';
}

export function AuthModal({ open, onOpenChange, initialTab = 'login' }: Props) {
  const t = useT();
  const [tab, setTab] = useState<'login' | 'signup'>(initialTab);

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title={
        <span className="text-gradient-gold">
          {tab === 'login' ? t('auth.loginTitle') : t('auth.signupTitle')}
        </span>
      }
      description={tab === 'login' ? t('auth.loginSub') : t('auth.signupSub')}
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'login' | 'signup')}>
        <TabsList className="w-full">
          <TabsTrigger value="login" className="flex-1">{t('common.login')}</TabsTrigger>
          <TabsTrigger value="signup" className="flex-1">{t('common.signup')}</TabsTrigger>
        </TabsList>

        <TabsContent value="login">
          <LoginForm onSuccess={() => onOpenChange(false)} />
        </TabsContent>
        <TabsContent value="signup">
          <SignupForm onSuccess={() => onOpenChange(false)} onSwitch={() => setTab('login')} />
        </TabsContent>
      </Tabs>
    </Modal>
  );
}

function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { phone: '', password: '' } });

  return (
    <form
      onSubmit={handleSubmit(async () => {
        setLoading(true);
        await new Promise((r) => setTimeout(r, 600));
        setLoading(false);
        onSuccess();
      })}
      className="space-y-4"
    >
      <FormField label={t('auth.phone')} required error={errors.phone ? t(`auth.${errors.phone.message}`) : undefined}>
        <Input
          leftIcon={<Phone className="h-4 w-4" />}
          placeholder="01XXXXXXXXX"
          inputMode="tel"
          {...register('phone')}
          invalid={!!errors.phone}
        />
      </FormField>
      <FormField label={t('auth.password')} required error={errors.password ? t(`auth.${errors.password.message}`) : undefined}>
        <Input
          leftIcon={<Lock className="h-4 w-4" />}
          type="password"
          placeholder="••••••••"
          {...register('password')}
          invalid={!!errors.password}
        />
      </FormField>
      <div className="flex items-center justify-between text-sm">
        <a href="#" className="text-ink-mid hover:text-ink-hi">{t('auth.forgot')}</a>
      </div>
      <Button full type="submit" size="lg" loading={loading} leftIcon={<KeyRound className="h-4 w-4" />}>
        {t('common.login')}
      </Button>
    </form>
  );
}

function SignupForm({ onSuccess, onSwitch }: { onSuccess: () => void; onSwitch: () => void }) {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { phone: '', password: '', confirm: '', referral: '', agree: false },
  });

  return (
    <form
      onSubmit={handleSubmit(async () => {
        setLoading(true);
        await new Promise((r) => setTimeout(r, 700));
        setLoading(false);
        onSuccess();
      })}
      className="space-y-4"
    >
      <FormField label={t('auth.phone')} required error={errors.phone ? t(`auth.${errors.phone.message}`) : undefined}>
        <Input leftIcon={<Phone className="h-4 w-4" />} placeholder="01XXXXXXXXX" inputMode="tel" {...register('phone')} invalid={!!errors.phone} />
      </FormField>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <FormField label={t('auth.password')} required error={errors.password ? t(`auth.${errors.password.message}`) : undefined}>
          <Input leftIcon={<Lock className="h-4 w-4" />} type="password" placeholder="••••••••" {...register('password')} invalid={!!errors.password} />
        </FormField>
        <FormField label={t('auth.confirm')} required error={errors.confirm ? t(`auth.${errors.confirm.message}`) : undefined}>
          <Input leftIcon={<Lock className="h-4 w-4" />} type="password" placeholder="••••••••" {...register('confirm')} invalid={!!errors.confirm} />
        </FormField>
      </div>
      <FormField label={t('auth.referral')}>
        <Input placeholder="ABCDE12" {...register('referral')} />
      </FormField>
      <label className="flex cursor-pointer items-start gap-2 text-sm text-ink-mid">
        <input type="checkbox" {...register('agree')} className="mt-1 h-4 w-4 accent-neon" />
        <span>{t('auth.agree')}</span>
      </label>
      {errors.agree ? <p className="-mt-2 text-xs text-signal-danger">{t(`auth.${errors.agree.message}`)}</p> : null}
      <Button full type="submit" size="lg" loading={loading} leftIcon={<UserPlus className="h-4 w-4" />}>
        {t('common.signup')}
      </Button>
      <p className="text-center text-sm text-ink-lo">
        <button type="button" onClick={onSwitch} className="text-neon hover:text-ink-hi">
          {t('auth.switchToLogin')}
        </button>
      </p>
    </form>
  );
}
