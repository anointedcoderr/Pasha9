// Built by Anointed Coder.
//
// M2K Security Center. Three tabs:
//   Login attempts   filterable feed from LoginAttempt
//   IP block list    CRUD over IpBlockRule
//   Tooling notes    docs for 2FA enrollment + cron-secret + SMS
//                    alert + heuristic flag glossary

'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { FormField, Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { ShieldCheck, RefreshCw, Ban, Plus, ListChecks, Wifi, Info } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';

interface AttemptRow {
  id: string;
  identifier: string;
  userId: string | null;
  username: string | null;
  surface: string;
  ip: string | null;
  userAgent: string | null;
  success: boolean;
  reason: string | null;
  flags: string[];
  createdAt: string;
}

interface IpRule {
  id: string;
  ip: string;
  reason: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export default function AdminSecurityPage() {
  const [tab, setTab] = useState<'attempts' | 'ip' | 'docs'>('attempts');

  // Attempts
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [attemptsLoading, setAttemptsLoading] = useState(true);
  const [surface, setSurface] = useState('');
  const [successFilter, setSuccessFilter] = useState('');
  const [query, setQuery] = useState('');
  const [ipFilter, setIpFilter] = useState('');

  // IP rules
  const [rules, setRules] = useState<IpRule[]>([]);
  const [ipDraft, setIpDraft] = useState('');
  const [ipReason, setIpReason] = useState('');
  const [ipExpiry, setIpExpiry] = useState('');
  const [creatingRule, setCreatingRule] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const flashToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 4500); };

  const loadAttempts = useCallback(async () => {
    setAttemptsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (surface) params.set('surface', surface);
      if (successFilter) params.set('success', successFilter);
      if (query.trim()) params.set('q', query.trim());
      if (ipFilter.trim()) params.set('ip', ipFilter.trim());
      params.set('take', '150');
      const res = await fetch(`/api/admin/security/login-attempts?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code);
      setAttempts(data.attempts as AttemptRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally { setAttemptsLoading(false); }
  }, [surface, successFilter, query, ipFilter]);

  const loadRules = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/security/ip-blocks', { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) setRules(data.rules as IpRule[]);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadAttempts(); loadRules(); }, [loadAttempts, loadRules]);

  const addRule = async () => {
    const ip = ipDraft.trim();
    if (!ip) return;
    setCreatingRule(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/security/ip-blocks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ip,
          reason: ipReason.trim() || undefined,
          expiresAt: ipExpiry ? new Date(ipExpiry).toISOString() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Add failed');
      setIpDraft(''); setIpReason(''); setIpExpiry('');
      flashToast(`Blocked ${ip}. Takes effect within ~60s as the cache refreshes (or immediately on the API that wrote it).`);
      loadRules();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Add failed');
    } finally { setCreatingRule(false); }
  };

  // In-page confirm (native confirm() is suppressed in the installed PWA)
  const [unblocking, setUnblocking] = useState<IpRule | null>(null);

  const removeRule = async (r: IpRule) => {
    try {
      const res = await fetch(`/api/admin/security/ip-blocks/${r.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? data?.code);
      flashToast(`Unblocked ${r.ip}.`);
      loadRules();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Remove failed');
    }
  };

  return (
    <>
      <PageHeader
        title="Security"
        subtitle="Login audit, IP block list, 2FA / TOTP enrollment, suspicious-activity flags"
        icon={<ShieldCheck className="h-5 w-5" />}
        action={
          <Button variant="ghost" leftIcon={<RefreshCw className={cn('h-3.5 w-3.5', attemptsLoading && 'animate-spin')} />} onClick={() => { loadAttempts(); loadRules(); }}>
            Reload
          </Button>
        }
      />

      {toast ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-ok">{toast}</p></Card> : null}
      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{error}</p></Card> : null}

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList>
          <TabsTrigger value="attempts"><ListChecks className="mr-1.5 h-3.5 w-3.5" /> Login attempts</TabsTrigger>
          <TabsTrigger value="ip"><Wifi className="mr-1.5 h-3.5 w-3.5" /> IP block list</TabsTrigger>
          <TabsTrigger value="docs"><Info className="mr-1.5 h-3.5 w-3.5" /> Tooling</TabsTrigger>
        </TabsList>

        <TabsContent value="attempts">
          <Card padding="md" className="mb-3">
            <div className="flex flex-wrap items-end gap-3">
              <FormField label="Surface">
                <Select value={surface} onChange={(e) => setSurface(e.target.value)}>
                  <option value="">All</option>
                  <option value="admin">Admin</option>
                  <option value="user">Player</option>
                </Select>
              </FormField>
              <FormField label="Result">
                <Select value={successFilter} onChange={(e) => setSuccessFilter(e.target.value)}>
                  <option value="">All</option>
                  <option value="true">Success only</option>
                  <option value="false">Failed only</option>
                </Select>
              </FormField>
              <FormField label="Identifier contains">
                <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="username or phone" />
              </FormField>
              <FormField label="IP contains">
                <Input value={ipFilter} onChange={(e) => setIpFilter(e.target.value)} placeholder="103.21.59" />
              </FormField>
              <Button leftIcon={<RefreshCw className="h-3.5 w-3.5" />} onClick={loadAttempts}>Apply</Button>
            </div>
          </Card>

          {attemptsLoading ? <p className="text-sm text-ink-mid">Loading...</p> : attempts.length === 0 ? (
            <Card padding="lg"><p className="text-sm text-ink-mid">No login attempts match the current filter.</p></Card>
          ) : (
            <Card padding="md" className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-sm">
                <thead className="text-xs uppercase tracking-wider text-ink-lo">
                  <tr>
                    <th className="px-2 py-2 text-left">When</th>
                    <th className="px-2 py-2 text-left">Surface</th>
                    <th className="px-2 py-2 text-left">Identifier</th>
                    <th className="px-2 py-2 text-left">User</th>
                    <th className="px-2 py-2 text-left">IP</th>
                    <th className="px-2 py-2 text-left">Result</th>
                    <th className="px-2 py-2 text-left">Reason</th>
                    <th className="px-2 py-2 text-left">Flags</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.map((a) => (
                    <tr key={a.id} className="border-t border-neon/10 align-top">
                      <td className="px-2 py-2 text-xs text-ink-lo">{new Date(a.createdAt).toLocaleString()}</td>
                      <td className="px-2 py-2"><Chip tone={a.surface === 'admin' ? 'info' : 'neutral'}>{a.surface}</Chip></td>
                      <td className="px-2 py-2 font-mono text-xs">{a.identifier}</td>
                      <td className="px-2 py-2 text-xs">{a.username ?? <span className="text-ink-lo">-</span>}</td>
                      <td className="px-2 py-2 font-mono text-xs">{a.ip ?? '-'}</td>
                      <td className="px-2 py-2"><Chip tone={a.success ? 'ok' : 'danger'}>{a.success ? 'ok' : 'fail'}</Chip></td>
                      <td className="px-2 py-2 text-xs text-ink-mid">{a.reason ?? '-'}</td>
                      <td className="px-2 py-2 text-xs">
                        {a.flags.length === 0 ? <span className="text-ink-lo">-</span> : a.flags.map((f) => <Chip key={f} tone="warn" className="mr-1">{f}</Chip>)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="ip">
          <Card padding="md" className="mb-3">
            <CardHeader title="Block a new IP or range" subtitle="IPv4 or CIDR (e.g. 10.0.0.0/24). Optional expiry auto-clears the rule." />
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e) => { e.preventDefault(); void addRule(); }}
            >
              <FormField label="IP / CIDR" required>
                <Input value={ipDraft} onChange={(e) => setIpDraft(e.target.value)} placeholder="103.21.59.42 or 103.21.59.0/24" />
              </FormField>
              <FormField label="Reason">
                <Input value={ipReason} onChange={(e) => setIpReason(e.target.value)} placeholder="e.g. brute-force attempts" />
              </FormField>
              <FormField label="Expires (optional)">
                <Input type="datetime-local" value={ipExpiry} onChange={(e) => setIpExpiry(e.target.value)} />
              </FormField>
              <Button type="submit" leftIcon={<Plus className="h-4 w-4" />} loading={creatingRule}>Block</Button>
            </form>
          </Card>

          {rules.length === 0 ? (
            <Card padding="lg"><p className="text-sm text-ink-mid">No IPs are currently blocked.</p></Card>
          ) : (
            <Card padding="md" className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead className="text-xs uppercase tracking-wider text-ink-lo">
                  <tr>
                    <th className="px-2 py-2 text-left">IP / CIDR</th>
                    <th className="px-2 py-2 text-left">Reason</th>
                    <th className="px-2 py-2 text-left">Expires</th>
                    <th className="px-2 py-2 text-left">Added</th>
                    <th className="px-2 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r) => (
                    <tr key={r.id} className="border-t border-neon/10">
                      <td className="px-2 py-2 font-mono text-sm text-ink-hi">{r.ip}</td>
                      <td className="px-2 py-2 text-xs text-ink-mid">{r.reason ?? '-'}</td>
                      <td className="px-2 py-2 text-xs text-ink-lo">{r.expiresAt ? new Date(r.expiresAt).toLocaleString() : 'never'}</td>
                      <td className="px-2 py-2 text-xs text-ink-lo">{new Date(r.createdAt).toLocaleString()}</td>
                      <td className="px-2 py-2 text-right">
                        <Button size="sm" variant="ghost" leftIcon={<Ban className="h-3.5 w-3.5" />} onClick={() => setUnblocking(r)}>Unblock</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="docs">
          <Card padding="lg">
            <CardHeader
              title="2FA / TOTP enrollment"
              subtitle="Fully wired end-to-end. /admin/login and the player auth modal both render a two-step UI: password first, then a 6-digit code input (or recovery code) when the account has 2FA enabled."
              action={<Chip tone="ok">UI live</Chip>}
            />
            <ol className="ml-5 list-decimal space-y-1 text-sm text-ink-mid">
              <li>Open /dashboard/security and click <b>Enable 2FA</b>. A safety banner explains the lock-out risk before any enrollment happens.</li>
              <li>Scan the QR with Google Authenticator / Authy / 1Password.</li>
              <li>Enter the 6-digit code to confirm. <b>10 recovery codes</b> are shown ONCE with <b>Copy all</b> and <b>Download .txt</b> buttons - save them offline.</li>
              <li>On the next /admin/login or auth modal login, after your password the UI prompts for the 6-digit code with a toggle to use a recovery code instead, and a Back-to-login button if you change your mind.</li>
              <li>Disable from /dashboard/security at any time (requires a current 6-digit OR an unused recovery code so a stolen session alone cannot turn it off).</li>
            </ol>
          </Card>

          <Card padding="lg" className="mt-4">
            <CardHeader title="Heuristic flag glossary" subtitle="Flags written to LoginAttempt.flags and surfaced in the table above." />
            <dl className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
              <Glossary k="admin_surface" v="The attempt targeted /admin/login." />
              <Glossary k="multiple_recent_failures" v="3+ failed attempts for this user in the last 15 minutes." />
              <Glossary k="ip_repeated_failures" v="3+ failed attempts from this IP in the last 15 minutes (anonymous)." />
              <Glossary k="new_ip" v="First time this user has logged in successfully from this IP." />
              <Glossary k="ip_blocked" v="Request rejected because the IP is on the block list." />
              <Glossary k="2fa" v="Attempt involved the 2FA challenge step." />
              <Glossary k="recovery_used" v="A single-use recovery code completed the 2FA challenge." />
            </dl>
          </Card>

          <Card padding="lg" className="mt-4">
            <CardHeader title="Encryption + alerts" subtitle="TOTP secrets are AES-256-GCM encrypted before storage. Admin login alerts dispatch via the M2I SMS provider configured at /admin/notifications." />
            <p className="text-sm text-ink-mid">
              Set <code className="font-mono text-xs text-ink-hi">SECRETS_KEY</code> in your VPS .env to a 64-char hex string so encrypted blobs survive a JWT secret rotation. Without it the wrapper falls back to a key derived from <code className="font-mono text-xs text-ink-hi">JWT_SECRET</code>.
            </p>
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={!!unblocking}
        onOpenChange={(v) => { if (!v) setUnblocking(null); }}
        title="Unblock this IP?"
        message={<>Remove the block rule for <span className="font-mono">{unblocking?.ip}</span>? Traffic from it will be allowed again.</>}
        messageBn={<>{unblocking?.ip} এর ব্লক নিয়মটি সরানো হবে? এই আইপি থেকে ট্রাফিক আবার অনুমোদিত হবে।</>}
        confirmLabel="Unblock"
        cancelLabel="Cancel"
        onConfirm={async () => { if (unblocking) await removeRule(unblocking); }}
      />
    </>
  );
}

function Glossary({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-lg border border-neon/10 bg-base-deep/40 p-3">
      <dt className="font-mono text-xs text-ink-hi">{k}</dt>
      <dd className="mt-1 text-xs text-ink-mid">{v}</dd>
    </div>
  );
}
