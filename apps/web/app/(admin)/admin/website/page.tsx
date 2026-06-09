// Built by Anointed Coder.
//
// Website Customization hub. Logo + Favicon upload (uses existing
// /api/admin/uploads endpoint with the new "branding" category) +
// Jackpot section editor (writes keyed SystemSetting rows that the
// public JackpotStrip reads via /api/content/jackpot). Also links
// out to every existing CMS surface.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
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
  Upload,
  Trash2,
  Crown,
  RefreshCw,
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

const JACKPOT_DEFAULTS = {
  title: 'Live Jackpot Pool',
  subtitle: 'Updated in real time',
  miniTitle: 'Mini',
  miniValue: '493',
  grandTitle: 'Grand',
  grandValue: '121497',
  majorTitle: 'Major',
  majorValue: '7923',
};

export default function AdminWebsitePage() {
  const [siteName, setSiteName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [faviconUrl, setFaviconUrl] = useState('');
  const [jpEnabled, setJpEnabled] = useState(true);
  const [jpTitle, setJpTitle] = useState('');
  const [jpSubtitle, setJpSubtitle] = useState('');
  const [jpBg, setJpBg] = useState('');
  const [jpMiniTitle, setJpMiniTitle] = useState('');
  const [jpMiniIcon, setJpMiniIcon] = useState('');
  const [jpMiniValue, setJpMiniValue] = useState('');
  const [jpGrandTitle, setJpGrandTitle] = useState('');
  const [jpGrandIcon, setJpGrandIcon] = useState('');
  const [jpGrandValue, setJpGrandValue] = useState('');
  const [jpMajorTitle, setJpMajorTitle] = useState('');
  const [jpMajorIcon, setJpMajorIcon] = useState('');
  const [jpMajorValue, setJpMajorValue] = useState('');

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
      setJpEnabled((map.get('jackpot_enabled') ?? '1') !== '0');
      setJpTitle(map.get('jackpot_title') ?? '');
      setJpSubtitle(map.get('jackpot_subtitle') ?? '');
      setJpBg(map.get('jackpot_bg_url') ?? '');
      setJpMiniTitle(map.get('jackpot_mini_title') ?? '');
      setJpMiniIcon(map.get('jackpot_mini_icon_url') ?? '');
      setJpMiniValue(map.get('jackpot_mini_value') ?? '');
      setJpGrandTitle(map.get('jackpot_grand_title') ?? '');
      setJpGrandIcon(map.get('jackpot_grand_icon_url') ?? '');
      setJpGrandValue(map.get('jackpot_grand_value') ?? '');
      setJpMajorTitle(map.get('jackpot_major_title') ?? '');
      setJpMajorIcon(map.get('jackpot_major_icon_url') ?? '');
      setJpMajorValue(map.get('jackpot_major_value') ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveBranding = async () => {
    setSaving(true);
    setError(null);
    try {
      // Bump the favicon version on every save so the
      // generateMetadata helper appends a fresh ?v=<...> query and
      // the browser re-fetches the icon instead of serving the
      // cached tab favicon. Timestamp is enough; a precise hash is
      // overkill for a 32x32 PNG.
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          updates: [
            { key: 'site_name', value: siteName.trim() },
            { key: 'logo_url', value: logoUrl.trim() },
            { key: 'favicon_url', value: faviconUrl.trim() },
            { key: 'favicon_version', value: String(Date.now()) },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Save failed');
      setToast('Branding saved. Public site picks up the new values on next page load.');
      setTimeout(() => setToast(null), 4500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const saveJackpot = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          updates: [
            { key: 'jackpot_enabled', value: jpEnabled ? '1' : '0' },
            { key: 'jackpot_title', value: jpTitle.trim() },
            { key: 'jackpot_subtitle', value: jpSubtitle.trim() },
            { key: 'jackpot_bg_url', value: jpBg.trim() },
            { key: 'jackpot_mini_title', value: jpMiniTitle.trim() },
            { key: 'jackpot_mini_icon_url', value: jpMiniIcon.trim() },
            { key: 'jackpot_mini_value', value: jpMiniValue.trim() },
            { key: 'jackpot_grand_title', value: jpGrandTitle.trim() },
            { key: 'jackpot_grand_icon_url', value: jpGrandIcon.trim() },
            { key: 'jackpot_grand_value', value: jpGrandValue.trim() },
            { key: 'jackpot_major_title', value: jpMajorTitle.trim() },
            { key: 'jackpot_major_icon_url', value: jpMajorIcon.trim() },
            { key: 'jackpot_major_value', value: jpMajorValue.trim() },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Save failed');
      setToast('Jackpot section saved.');
      setTimeout(() => setToast(null), 4500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const resetJackpot = () => {
    setJpTitle(JACKPOT_DEFAULTS.title);
    setJpSubtitle(JACKPOT_DEFAULTS.subtitle);
    setJpMiniTitle(JACKPOT_DEFAULTS.miniTitle);
    setJpMiniValue(JACKPOT_DEFAULTS.miniValue);
    setJpGrandTitle(JACKPOT_DEFAULTS.grandTitle);
    setJpGrandValue(JACKPOT_DEFAULTS.grandValue);
    setJpMajorTitle(JACKPOT_DEFAULTS.majorTitle);
    setJpMajorValue(JACKPOT_DEFAULTS.majorValue);
  };

  return (
    <>
      <PageHeader
        title="Website Customization"
        subtitle="Brand, banners, popups, homepage, jackpot and game content"
        icon={<Megaphone className="h-5 w-5" />}
      />

      {toast ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-ok">{toast}</p></Card> : null}
      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{error}</p></Card> : null}

      {/* ============================== Branding ============================ */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card padding="lg" className="lg:col-span-2">
          <CardHeader title="Logo & Favicon" subtitle="Used in the header, drawer, admin sidebar, admin login and the browser tab icon" />
          {loading ? (
            <p className="text-sm text-ink-mid">Loading...</p>
          ) : (
            <div className="space-y-4">
              <FormField label="Display site name" hint="Falls back to Pasha 9 when empty. Shown when no logo image is uploaded.">
                <Input value={siteName} onChange={(e) => setSiteName(e.target.value)} placeholder="Pasha 9" />
              </FormField>

              <BrandUploader
                kind="branding"
                label="Logo"
                value={logoUrl}
                onChange={setLogoUrl}
                hint="Recommended 500 x 150 PNG or WebP with a transparent background. Replaces the Pasha 9 wordmark on every site-name surface."
                large
              />

              <BrandUploader
                kind="branding"
                label="Favicon"
                value={faviconUrl}
                onChange={setFaviconUrl}
                hint="512 x 512 PNG for PWA / Home Screen and 32 x 32 PNG or SVG for the browser tab. Pasha 9 serves the same file at /favicon.ico, /icon, /apple-icon and inside the PWA manifest, all with an auto-bumped ?v query that defeats local browser cache on every save."
              />
              <details className="rounded-lg border border-brand-divider bg-brand-surface px-3 py-2 text-[12px]">
                <summary className="cursor-pointer font-semibold text-ink-hi">
                  Why does my browser still show the old favicon?
                </summary>
                <div className="mt-2 space-y-1.5 text-ink-mid">
                  <p>
                    The current browser tab and bookmarks cache the icon locally for weeks. After
                    saving here, the live <code className="font-mono">{`<link rel="icon">`}</code>
                    and <code className="font-mono">/favicon.ico</code> already point at the new
                    file with a fresh <code className="font-mono">?v</code> query. To see it now:
                  </p>
                  <ol className="list-decimal space-y-0.5 pl-5">
                    <li>Hard refresh the public site (Ctrl + Shift + R on desktop, pull-to-refresh on mobile).</li>
                    <li>Close and reopen the browser tab if the favicon was already cached.</li>
                    <li>For PWA / Home Screen icons, uninstall and reinstall the PWA.</li>
                    <li>For browser search-history suggestions (Firefox Suggest, Chrome address bar), visit the homepage once so the cache refreshes from the new <code className="font-mono">/favicon.ico</code>.</li>
                    <li>Google / Bing / DuckDuckGo search-result favicons are re-crawled on their schedule (typically 3 to 14 days).</li>
                  </ol>
                </div>
              </details>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={load}>Reset</Button>
                <Button variant="gold" loading={saving} leftIcon={<Save className="h-3.5 w-3.5" />} onClick={saveBranding}>
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
              <span>Uploaded logo replaces the bundled gold mark + Pasha 9 wordmark on the public header, mobile drawer, admin sidebar and admin login.</span>
            </li>
            <li className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 text-gold-300" />
              <span>Logo + favicon are read on every page load via <code className="font-mono">/api/content/branding</code>. No rebuild needed.</span>
            </li>
            <li className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 text-gold-300" />
              <span>Click <strong>Remove</strong> to clear an uploaded URL. The site reverts to the bundled mark / default favicon.</span>
            </li>
            <li className="flex items-start gap-2">
              <Chip tone="warn">M2</Chip>
              <span>Color theme override + per-language brand variants ship in Milestone 2.</span>
            </li>
          </ul>
        </Card>
      </div>

      {/* ============================== Jackpot ============================ */}
      <Card padding="lg" className="mt-6">
        <CardHeader
          title="Jackpot Section"
          subtitle="Edits the homepage Jackpot card. Counter values are display-only, no wallet impact."
          action={
            <div className="flex items-center gap-3">
              <Switch checked={jpEnabled} onChange={setJpEnabled} label="Enable jackpot section" />
              <span className="text-xs text-ink-mid">{jpEnabled ? 'Visible' : 'Hidden'}</span>
            </div>
          }
        />
        {loading ? (
          <p className="text-sm text-ink-mid">Loading...</p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Section title" hint="Falls back to 'Live Jackpot Pool' when empty.">
                <Input value={jpTitle} onChange={(e) => setJpTitle(e.target.value)} placeholder={JACKPOT_DEFAULTS.title} />
              </FormField>
              <FormField label="Subtitle / tagline">
                <Input value={jpSubtitle} onChange={(e) => setJpSubtitle(e.target.value)} placeholder={JACKPOT_DEFAULTS.subtitle} />
              </FormField>
            </div>

            <BrandUploader
              kind="jackpot"
              label="Background banner"
              value={jpBg}
              onChange={setJpBg}
              hint="Optional. 1600 x 480 PNG / WebP / JPG. When set, blends behind the jackpot card."
              large
            />

            <div className="grid gap-3 md:grid-cols-3">
              <JackpotCardEditor
                icon={<Sparkles className="h-3.5 w-3.5" />}
                color="from-amber-300 to-amber-600"
                title="Mini"
                cardTitle={jpMiniTitle}
                onCardTitle={setJpMiniTitle}
                cardValue={jpMiniValue}
                onCardValue={setJpMiniValue}
                cardIcon={jpMiniIcon}
                onCardIcon={setJpMiniIcon}
                defaultTitle={JACKPOT_DEFAULTS.miniTitle}
                defaultValue={JACKPOT_DEFAULTS.miniValue}
              />
              <JackpotCardEditor
                icon={<Crown className="h-3.5 w-3.5" />}
                color="from-rose-400 to-red-700"
                title="Grand"
                cardTitle={jpGrandTitle}
                onCardTitle={setJpGrandTitle}
                cardValue={jpGrandValue}
                onCardValue={setJpGrandValue}
                cardIcon={jpGrandIcon}
                onCardIcon={setJpGrandIcon}
                defaultTitle={JACKPOT_DEFAULTS.grandTitle}
                defaultValue={JACKPOT_DEFAULTS.grandValue}
              />
              <JackpotCardEditor
                icon={<Trophy className="h-3.5 w-3.5" />}
                color="from-sky-400 to-blue-800"
                title="Major"
                cardTitle={jpMajorTitle}
                onCardTitle={setJpMajorTitle}
                cardValue={jpMajorValue}
                onCardValue={setJpMajorValue}
                cardIcon={jpMajorIcon}
                onCardIcon={setJpMajorIcon}
                defaultTitle={JACKPOT_DEFAULTS.majorTitle}
                defaultValue={JACKPOT_DEFAULTS.majorValue}
              />
            </div>

            <p className="text-xs text-ink-mid">
              Reset only resets the displayed counter values + titles to their premium defaults. No user balance, no transaction
              and no wallet logic is touched.
            </p>

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Button variant="ghost" leftIcon={<RefreshCw className="h-3.5 w-3.5" />} onClick={resetJackpot}>
                Reset to defaults
              </Button>
              <Button variant="ghost" onClick={load}>Reload from DB</Button>
              <Button variant="gold" loading={saving} leftIcon={<Save className="h-3.5 w-3.5" />} onClick={saveJackpot}>
                Save Jackpot
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* ====================== Content & media editors ===================== */}
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

/* ======================== Reusable upload widgets ======================= */

function BrandUploader({
  kind,
  label,
  value,
  onChange,
  hint,
  large,
}: {
  kind: 'branding' | 'jackpot';
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint: string;
  large?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const upload = async (file: File) => {
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('category', kind);
      const res = await fetch('/api/admin/uploads', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Upload failed');
      onChange(data.url as string);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <FormField label={label} hint={hint}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <div className={`flex items-center justify-center rounded-xl border border-neon/10 bg-base-deep/40 ${large ? 'min-h-[88px] w-full sm:w-[200px]' : 'min-h-[64px] w-full sm:w-[120px]'}`}>
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className={large ? 'h-16 max-w-full object-contain' : 'h-10 w-10 object-contain'} />
          ) : (
            <p className="px-2 text-[11px] text-ink-lo">No image</p>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="/uploads/branding/..." />
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
              }}
            />
            <Button size="sm" variant="neon" leftIcon={<Upload className="h-3.5 w-3.5" />} loading={busy} onClick={() => fileRef.current?.click()}>
              {value ? 'Replace' : 'Upload'}
            </Button>
            {value ? (
              <Button size="sm" variant="danger" leftIcon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => onChange('')}>
                Remove
              </Button>
            ) : null}
          </div>
          {err ? <p className="text-xs text-signal-danger">{err}</p> : null}
        </div>
      </div>
    </FormField>
  );
}

function JackpotCardEditor({
  icon,
  color,
  title,
  cardTitle,
  onCardTitle,
  cardValue,
  onCardValue,
  cardIcon,
  onCardIcon,
  defaultTitle,
  defaultValue,
}: {
  icon: React.ReactNode;
  color: string;
  title: string;
  cardTitle: string;
  onCardTitle: (v: string) => void;
  cardValue: string;
  onCardValue: (v: string) => void;
  cardIcon: string;
  onCardIcon: (v: string) => void;
  defaultTitle: string;
  defaultValue: string;
}) {
  return (
    <div className="rounded-xl border border-neon/10 bg-base-deep/30 p-3">
      <div className="mb-3 flex items-center gap-2">
        <span className={`flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br text-white ${color}`}>
          {icon}
        </span>
        <p className="text-sm font-bold text-ink-hi">{title}</p>
      </div>
      <div className="space-y-3">
        <FormField label="Card title">
          <Input value={cardTitle} onChange={(e) => onCardTitle(e.target.value)} placeholder={defaultTitle} />
        </FormField>
        <FormField label="Current value" hint="Display only. The premium ticker still adds small live increments on top.">
          <Input type="number" min="0" value={cardValue} onChange={(e) => onCardValue(e.target.value)} placeholder={defaultValue} />
        </FormField>
        <BrandUploader
          kind="jackpot"
          label="Icon (optional)"
          value={cardIcon}
          onChange={onCardIcon}
          hint="Square PNG / SVG. Replaces the bundled icon when set."
        />
      </div>
    </div>
  );
}
