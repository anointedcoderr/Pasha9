// Built by Anointed Coder.
//
// Website Customization hub. One screen for the operator to edit logo
// + favicon + site name (writes to SystemSetting via the existing
// /api/admin/settings PATCH route) and to jump into the existing
// banner / popup / homepage / promo / ambassador / lotto / rewards
// CMS surfaces.

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/Input';
import { Chip } from '@/components/ui/Chip';
import {
  Megaphone,
  Image as ImageIcon,
  Type,
  Home,
  Star,
  Ticket,
  Trophy,
  Settings,
  Sparkles,
  Save,
  Layers,
  Boxes,
} from 'lucide-react';
import { ROUTES } from '@/lib/constants/routes';

interface SettingRow { key: string; value: string }

const LIVE_LINKS = [
  { href: ROUTES.admin.banners, icon: ImageIcon, label: 'Banners & Hero (image / video)' },
  { href: ROUTES.admin.popups, icon: Megaphone, label: 'Announcement Popups' },
  { href: ROUTES.admin.promoText, icon: Type, label: 'Promo Marquee Text' },
  { href: ROUTES.admin.homepage, icon: Home, label: 'Homepage Sections' },
  { href: '/admin/ambassador', icon: Star, label: 'Ambassador + Promo Video' },
  { href: '/admin/lotto', icon: Ticket, label: 'Lotto Draws + Settlement' },
  { href: '/admin/rewards', icon: Trophy, label: 'Reward Catalog' },
  { href: ROUTES.admin.categories, icon: Layers, label: 'Game Categories' },
  { href: ROUTES.admin.providers, icon: Boxes, label: 'Game Providers' },
  { href: ROUTES.admin.settings, icon: Settings, label: 'Public Support Contacts + System Settings' },
];

export default function AdminWebsitePage() {
  const [siteName, setSiteName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [faviconUrl, setFaviconUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/settings', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code);
      const map = new Map<string, string>((data.settings as SettingRow[]).map((s) => [s.key, s.value ?? '']));
      setSiteName(map.get('site_name') ?? '');
      setLogoUrl(map.get('logo_url') ?? '');
      setFaviconUrl(map.get('favicon_url') ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          updates: [
            { key: 'site_name', value: siteName.trim() },
            { key: 'logo_url', value: logoUrl.trim() },
            { key: 'favicon_url', value: faviconUrl.trim() },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Save failed');
      setToast('Branding saved. Public site will pick up the new values on next page load.');
      setTimeout(() => setToast(null), 4500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Website Customization"
        subtitle="Brand, banners, popups, homepage and game content"
        icon={<Megaphone className="h-5 w-5" />}
      />

      {toast ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-ok">{toast}</p></Card> : null}
      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{error}</p></Card> : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card padding="lg" className="lg:col-span-2">
          <CardHeader title="Logo & Favicon" subtitle="Used in the header, drawer, admin sidebar, admin login and the browser tab icon" />
          {loading ? (
            <p className="text-sm text-ink-mid">Loading...</p>
          ) : (
            <div className="space-y-4">
              <FormField label="Display site name" hint="Falls back to Pasha 9 when empty.">
                <Input value={siteName} onChange={(e) => setSiteName(e.target.value)} placeholder="Pasha 9" />
              </FormField>
              <FormField label="Logo URL" hint="PNG / SVG, recommended 512x512. When set, the public site renders the image instead of the bundled SVG mark. Leave empty to use the bundled mark.">
                <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://pasha9.com/uploads/branding/logo.png" />
              </FormField>
              <FormField label="Favicon URL" hint="32x32 PNG / SVG. Applied to the browser tab.">
                <Input value={faviconUrl} onChange={(e) => setFaviconUrl(e.target.value)} placeholder="https://pasha9.com/uploads/branding/favicon.png" />
              </FormField>
              <div className="grid gap-3 sm:grid-cols-2">
                <PreviewBox label="Logo preview" url={logoUrl} fallback="Bundled SVG mark" />
                <PreviewBox label="Favicon preview" url={faviconUrl} fallback="Default favicon" small />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={load}>Reset</Button>
                <Button variant="gold" loading={saving} leftIcon={<Save className="h-3.5 w-3.5" />} onClick={save}>
                  Save Branding
                </Button>
              </div>
            </div>
          )}
        </Card>

        <Card padding="lg">
          <CardHeader title="Quick reference" />
          <ul className="space-y-2 text-xs text-ink-mid">
            <li className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 text-gold-300" />
              <span>Use the existing <Link href="/api/admin/uploads" className="text-gold-300 hover:underline">/api/admin/uploads</Link> endpoint to host an image, then paste the returned path here.</span>
            </li>
            <li className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 text-gold-300" />
              <span>Logo + favicon are read by every page load via <code className="font-mono">/api/content/branding</code> - no rebuild needed.</span>
            </li>
            <li className="flex items-start gap-2">
              <Chip tone="warn">M2</Chip>
              <span>Color theme override + per-language brand variants ship in Milestone 2.</span>
            </li>
          </ul>
        </Card>
      </div>

      <Card padding="lg" className="mt-6">
        <CardHeader title="Content & media editors" subtitle="Jump into the surface you want to edit" />
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {LIVE_LINKS.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className="card-glow group flex items-center gap-3 p-4 transition hover:ring-1 hover:ring-gold-500/30"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500/10 text-gold-300">
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-sm font-extrabold text-ink-hi group-hover:text-gold-300">{label}</span>
            </Link>
          ))}
        </div>
      </Card>
    </>
  );
}

function PreviewBox({ label, url, fallback, small }: { label: string; url: string; fallback: string; small?: boolean }) {
  return (
    <div className="rounded-xl border border-neon/10 bg-base-deep/40 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-lo">{label}</p>
      <div className="mt-2 flex items-center justify-center rounded-lg bg-base-panel/60 p-4">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className={small ? 'h-10 w-10 object-contain' : 'h-16 w-auto max-w-full object-contain'} />
        ) : (
          <p className="text-[11px] text-ink-mid">{fallback}</p>
        )}
      </div>
    </div>
  );
}
