// Built by Anointed Coder.
//
// Profile page. Real Save button: PATCH /api/me/profile applies field
// updates (with uniqueness checks server-side). Avatar upload via
// POST /api/me/avatar. Change-password via POST /api/me/password.
// The legacy "Inline profile edits ship in Milestone 2" placeholder
// is gone.

'use client';

import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { FormField, Input, PasswordInput } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useMe } from '@/lib/hooks/useMe';
import { useLang } from '@/lib/i18n/context';
import { User as UserIcon, Phone, AtSign, Save, Upload, Lock } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { triggerWalletRefresh } from '@/components/site/WalletStrip';

export default function ProfilePage() {
  const { me, loading } = useMe();
  const { lang, setLang } = useLang();
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Bilingual show/hide labels for the password reveal toggles so the
  // screen-reader announcement is not English-only.
  const pwShowLabel = lang === 'bn' ? 'পাসওয়ার্ড দেখান' : 'Show password';
  const pwHideLabel = lang === 'bn' ? 'পাসওয়ার্ড লুকান' : 'Hide password';

  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [language, setLanguage] = useState<'bn' | 'en'>('bn');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    if (!me) return;
    setUsername(me.username);
    setPhone(me.phone);
    setEmail(me.email ?? '');
    setLanguage((me.language as 'bn' | 'en') ?? 'bn');
    setAvatarUrl((me as { avatarUrl?: string | null }).avatarUrl ?? null);
  }, [me]);

  const initials = (me?.username ?? '..').slice(0, 2).toUpperCase();

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(null); setToast(null);
    try {
      const body: Record<string, string> = {};
      if (username !== me?.username) body.username = username.trim();
      if (phone !== me?.phone) body.phone = phone.trim();
      if (email !== (me?.email ?? '')) body.email = email.trim();
      if (language !== me?.language) body.language = language;
      if (Object.keys(body).length === 0) { setToast('No changes to save.'); return; }
      const r = await fetch('/api/me/profile', { method: 'PATCH', headers: { 'content-type': 'application/json' }, credentials: 'include', body: JSON.stringify(body) });
      const j = await r.json().catch(() => null);
      if (!r.ok) { setError(j?.message ?? j?.code ?? 'Save failed'); return; }
      setToast('Profile updated.');
      // Apply the language choice immediately: this persists the cookie +
      // localStorage so SSR and the rest of the app switch without a manual
      // toggle. Runs after the DB save succeeded and only when it changed.
      if (language !== me?.language) setLang(language);
      triggerWalletRefresh();
    } finally { setSaving(false); }
  };

  const onAvatar = async (file: File | null) => {
    if (!file) return;
    setUploading(true); setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch('/api/me/avatar', { method: 'POST', credentials: 'include', body: fd });
      const j = await r.json().catch(() => null);
      if (!r.ok) { setError(j?.message ?? j?.code ?? 'Upload failed'); return; }
      setAvatarUrl(j.avatarUrl);
      setToast('Avatar updated.');
      triggerWalletRefresh();
    } finally { setUploading(false); }
  };

  const onChangePw = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setToast(null);
    if (newPw.length < 6) { setError('New password must be at least 6 characters.'); return; }
    if (newPw !== confirmPw) { setError('New password and confirmation do not match.'); return; }
    setPwBusy(true);
    try {
      const r = await fetch('/api/me/password', {
        method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ currentPassword: curPw, newPassword: newPw }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) { setError(j?.message ?? j?.code ?? 'Password change failed'); return; }
      setToast('Password changed.');
      setCurPw(''); setNewPw(''); setConfirmPw('');
    } finally { setPwBusy(false); }
  };

  return (
    <>
      <PageHeader title="Profile" subtitle="Manage your account information" icon={<UserIcon className="h-5 w-5" />} />

      {toast ? <Card padding="sm" className="mb-4 border-l-4 border-emerald-400/60"><p className="text-sm text-emerald-700">{toast}</p></Card> : null}
      {error ? <Card padding="sm" className="mb-4 border-l-4 border-rose-400/60"><p className="text-sm text-rose-700">{error}</p></Card> : null}

      <div className="grid gap-6 pb-24 lg:grid-cols-3">
        <Card tone="elev" className="lg:col-span-1 flex flex-col items-center text-center" padding="lg">
          <div className="relative">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="block h-24 w-24 overflow-hidden rounded-full bg-grad-gold text-2xl font-bold text-base-deep"
              aria-label="Change avatar"
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center">{initials}</span>
              )}
            </button>
            <span className="absolute -bottom-1 right-0 flex h-7 w-7 items-center justify-center rounded-full border border-base-deep bg-neon text-base-deep">
              {uploading ? <span className="text-xs">...</span> : <Upload className="h-3.5 w-3.5" />}
            </span>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onAvatar(e.target.files?.[0] ?? null)} />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-ink-hi">{loading ? '...' : me?.username ?? 'Guest'}</h2>
          <p className="text-xs text-ink-lo">{me?.phone ?? ''}</p>
          <button type="button" onClick={() => fileRef.current?.click()} className="mt-3 text-xs font-semibold text-brand-yellow-700 hover:underline">
            {avatarUrl ? 'Change photo' : 'Upload photo'}
          </button>
          <p className="mt-1 text-[10px] text-ink-lo">PNG, JPG or WEBP. Max 2 MB.</p>
        </Card>

        <Card className="lg:col-span-2" padding="lg">
          <CardHeader title="Personal Information" subtitle="Edit any field and click Save Changes." />
          <form className="grid gap-4 md:grid-cols-2" onSubmit={onSave}>
            <FormField label="Username">
              <Input value={username} onChange={(e) => setUsername(e.target.value)} leftIcon={<UserIcon className="h-4 w-4" />} />
            </FormField>
            <FormField label="Phone">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} leftIcon={<Phone className="h-4 w-4" />} />
            </FormField>
            <FormField label="Email (optional)">
              <Input value={email} onChange={(e) => setEmail(e.target.value)} leftIcon={<AtSign className="h-4 w-4" />} placeholder="optional" type="email" />
            </FormField>
            <FormField label="Language">
              <select value={language} onChange={(e) => setLanguage(e.target.value as 'bn' | 'en')} className="h-10 w-full rounded-lg border border-brand-divider bg-brand-paper px-3 text-sm">
                <option value="bn">Bangla</option>
                <option value="en">English</option>
              </select>
            </FormField>
            <div className="md:col-span-2">
              <Button type="submit" loading={saving} leftIcon={<Save className="h-4 w-4" />}>
                Save Changes
              </Button>
            </div>
          </form>
        </Card>

        <Card className="lg:col-span-3" padding="lg">
          <CardHeader title="Change Password" subtitle="Verify your current password to set a new one." />
          <form className="grid gap-4 md:grid-cols-3" onSubmit={onChangePw}>
            <FormField label="Current password">
              <PasswordInput
                value={curPw}
                onChange={(e) => setCurPw(e.target.value)}
                leftIcon={<Lock className="h-4 w-4" />}
                autoComplete="current-password"
                showLabel={pwShowLabel}
                hideLabel={pwHideLabel}
              />
            </FormField>
            <FormField label="New password">
              <PasswordInput
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                leftIcon={<Lock className="h-4 w-4" />}
                autoComplete="new-password"
                showLabel={pwShowLabel}
                hideLabel={pwHideLabel}
              />
            </FormField>
            <FormField label="Confirm new password">
              <PasswordInput
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                leftIcon={<Lock className="h-4 w-4" />}
                autoComplete="new-password"
                showLabel={pwShowLabel}
                hideLabel={pwHideLabel}
              />
            </FormField>
            <div className="md:col-span-3">
              <Button type="submit" loading={pwBusy} leftIcon={<Lock className="h-4 w-4" />}>
                Change Password
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
