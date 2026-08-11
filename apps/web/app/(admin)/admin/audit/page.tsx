// Built by Anointed Coder.
//
// Audit & Accountability. Two-way search over the permanent records:
//
//   User  -> every staff member who changed them, and every money movement
//   Staff -> every player they touched and what they changed
//   Checks -> platform-wide sweep for any wallet that disagrees with its records
//
// Both directions read the same three append-only tables through
// /api/admin/audit, so the two views can never tell different stories about
// the same event.
//
// Defaults to the last 24 hours per the client's requirement, with a date
// range for older periods.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/Input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { ShieldCheck, Search, AlertTriangle } from 'lucide-react';

type Mode = 'user' | 'staff' | 'anomalies';

interface Row {
  at: string;
  source: 'money' | 'turnover' | 'action';
  id: string;
  action: string;
  detail: string | null;
  status?: string | null;
  balanceBefore: string | null;
  change: string | null;
  balanceAfter: string | null;
  turnoverBefore: string | null;
  turnoverAfter: string | null;
  reason: string | null;
  actorId?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  subjectId?: string | null;
  subjectName?: string | null;
  reference?: string | null;
  game?: string | null;
}

interface Subject {
  id: string;
  username: string;
  phone?: string | null;
  status?: string | null;
  role?: string | null;
  balance?: string;
}

interface Anomaly {
  userId: string;
  username: string;
  walletBalance: string;
  ledgerTotal: string;
  difference: string;
}

function fmt(at: string) {
  const d = new Date(at);
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// A movement's direction should be readable without parsing the sign.
function Amount({ value }: { value: string | null }) {
  if (value === null) return <span className="text-ink-lo">.</span>;
  const negative = value.trim().startsWith('-');
  return (
    <span className={negative ? 'text-signal-danger' : 'text-signal-ok'}>
      {negative ? '' : '+'}{value}
    </span>
  );
}

const SOURCE_LABEL: Record<Row['source'], string> = {
  money: 'Money',
  turnover: 'Turnover',
  action: 'Admin action',
};

export default function AdminAuditPage() {
  const [mode, setMode] = useState<Mode>('user');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[] | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Distinguishes "nothing found" from "you have not searched yet", which
  // otherwise look identical and read as a broken screen.
  const [searched, setSearched] = useState(false);

  const run = useCallback(async (m: Mode) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ mode: m });
      if (m !== 'anomalies') {
        if (!q.trim()) { setRows([]); setSubject(null); setSearched(false); return; }
        params.set('q', q.trim());
        if (from) params.set('from', new Date(from).toISOString());
        if (to) params.set('to', new Date(to).toISOString());
      }
      const res = await fetch(`/api/admin/audit?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Search failed');
      if (m === 'anomalies') {
        setAnomalies(data.anomalies ?? []);
      } else {
        setRows(data.rows ?? []);
        setSubject(data.subject ?? null);
      }
      setSearched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
      setRows([]);
      setSubject(null);
    } finally {
      setLoading(false);
    }
  }, [q, from, to]);

  useEffect(() => { if (mode === 'anomalies' && anomalies === null) void run('anomalies'); }, [mode, anomalies, run]);

  // The two search tabs share one result set, so switching between them would
  // otherwise show a player's rows under "everything this staff member did".
  // Clearing on switch is right rather than keeping per-tab copies: the same
  // name means different things in each tab, so the previous result is never
  // the answer to the new question.
  useEffect(() => {
    setRows([]);
    setSubject(null);
    setSearched(false);
    setError(null);
  }, [mode]);

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        icon={<ShieldCheck className="h-5 w-5" />}
        title="Audit & Accountability"
        subtitle="Search a player to see every staff member who changed them. Search a staff member to see every player they touched. These records cannot be edited or deleted by anyone."
        back={{ href: '/admin', label: 'Dashboard' }}
      />

      <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
        <TabsList>
          <TabsTrigger value="user">By player</TabsTrigger>
          <TabsTrigger value="staff">By staff member</TabsTrigger>
          <TabsTrigger value="anomalies">Balance checks</TabsTrigger>
        </TabsList>

        {(['user', 'staff'] as const).map((m) => (
          <TabsContent key={m} value={m}>
            <Card padding="lg" className="mt-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <FormField
                  label={m === 'user' ? 'Username, user ID or phone' : 'Staff username or ID'}
                  hint={m === 'user' ? 'Any one of the three is enough.' : 'The admin or staff member whose actions you want to review.'}
                >
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void run(m); }}
                    placeholder={m === 'user' ? 'e.g. shoyaib1026' : 'e.g. superadmin'}
                  />
                </FormField>
                <FormField label="From" hint="Leave both blank for the last 24 hours.">
                  <Input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
                </FormField>
                <FormField label="To" hint="Defaults to now.">
                  <Input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
                </FormField>
                <div className="flex items-end">
                  <Button onClick={() => void run(m)} loading={loading} leftIcon={<Search className="h-3.5 w-3.5" />}>
                    Search
                  </Button>
                </div>
              </div>
              {error ? <p className="mt-3 text-sm text-signal-danger" role="alert">{error}</p> : null}
            </Card>

            {subject ? (
              <Card padding="lg" className="mt-4">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                  <span className="font-semibold text-ink-hi">{subject.username}</span>
                  {subject.phone ? <span className="text-ink-mid">{subject.phone}</span> : null}
                  {subject.role ? <span className="text-ink-mid">{subject.role}</span> : null}
                  {subject.status ? <span className="text-ink-mid">{subject.status}</span> : null}
                  {subject.balance ? <span className="text-ink-mid">Balance {subject.balance}</span> : null}
                  <span className="text-xs text-ink-lo">ID {subject.id}</span>
                </div>
              </Card>
            ) : null}

            <Card padding="lg" className="mt-4">
              <CardHeader
                title={m === 'user' ? 'Everything that happened to this player' : 'Everything this staff member did'}
                subtitle={`${rows.length} record${rows.length === 1 ? '' : 's'}, newest first. Showing at most 500.`}
              />
              {/* Wide table, so it scrolls inside its own box rather than the page. */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="text-xs uppercase text-ink-lo">
                    <tr className="border-b border-neon/10">
                      <th scope="col" className="py-2 pr-3 font-medium">When</th>
                      <th scope="col" className="py-2 pr-3 font-medium">Type</th>
                      <th scope="col" className="py-2 pr-3 font-medium">Action</th>
                      <th scope="col" className="py-2 pr-3 font-medium">{m === 'user' ? 'Done by' : 'Player'}</th>
                      <th scope="col" className="py-2 pr-3 text-right font-medium">Before</th>
                      <th scope="col" className="py-2 pr-3 text-right font-medium">Change</th>
                      <th scope="col" className="py-2 pr-3 text-right font-medium">After</th>
                      <th scope="col" className="py-2 pr-3 font-medium">Reason / detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const isTurnover = r.source === 'turnover';
                      const before = isTurnover ? r.turnoverBefore : r.balanceBefore;
                      const after = isTurnover ? r.turnoverAfter : r.balanceAfter;
                      return (
                        <tr key={`${r.source}-${r.id}`} className="border-b border-neon/5 align-top">
                          <td className="whitespace-nowrap py-2 pr-3 text-ink-mid">{fmt(r.at)}</td>
                          <td className="py-2 pr-3 text-ink-mid">{SOURCE_LABEL[r.source]}</td>
                          <td className="py-2 pr-3 font-medium text-ink-hi">{r.action}</td>
                          <td className="py-2 pr-3 text-ink-mid">
                            {m === 'user'
                              ? (r.actorName ? <>{r.actorName}{r.actorRole ? <span className="block text-xs text-ink-lo">{r.actorRole}</span> : null}</> : <span className="text-ink-lo">system</span>)
                              : (r.subjectName ?? <span className="text-ink-lo">.</span>)}
                          </td>
                          <td className="whitespace-nowrap py-2 pr-3 text-right text-ink-mid">{before ?? <span className="text-ink-lo">.</span>}</td>
                          <td className="whitespace-nowrap py-2 pr-3 text-right"><Amount value={r.change} /></td>
                          <td className="whitespace-nowrap py-2 pr-3 text-right text-ink-mid">{after ?? <span className="text-ink-lo">.</span>}</td>
                          <td className="py-2 pr-3 text-ink-mid">
                            {r.reason ?? r.detail ?? <span className="text-ink-lo">.</span>}
                            {r.reference ? <span className="block text-xs text-ink-lo">ref {r.reference}</span> : null}
                            {r.game ? <span className="block text-xs text-ink-lo">{r.game}</span> : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {rows.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-lo">
                  {loading ? 'Searching...' : searched ? 'No records in this period. Try widening the dates.' : 'Enter a name above and press Search.'}
                </p>
              ) : null}
            </Card>
          </TabsContent>
        ))}

        <TabsContent value="anomalies">
          <Card padding="lg" className="mt-4">
            <CardHeader
              title="Balance checks"
              subtitle="Every player whose wallet does not match the sum of their recorded history. An empty list is the correct result."
            />
            <div className="mb-3">
              <Button onClick={() => void run('anomalies')} loading={loading} variant="ghost">Re-run check</Button>
            </div>
            {anomalies === null ? (
              <p className="py-6 text-center text-sm text-ink-lo">Running...</p>
            ) : anomalies.length === 0 ? (
              <p className="py-6 text-center text-sm text-signal-ok">
                All balances match their records. Nothing to investigate.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead className="text-xs uppercase text-ink-lo">
                    <tr className="border-b border-neon/10">
                      <th scope="col" className="py-2 pr-3 font-medium">Player</th>
                      <th scope="col" className="py-2 pr-3 text-right font-medium">Wallet</th>
                      <th scope="col" className="py-2 pr-3 text-right font-medium">Records total</th>
                      <th scope="col" className="py-2 pr-3 text-right font-medium">Difference</th>
                      <th scope="col" className="py-2 pr-3 font-medium">Open</th>
                    </tr>
                  </thead>
                  <tbody>
                    {anomalies.map((a) => (
                      <tr key={a.userId} className="border-b border-neon/5">
                        <td className="py-2 pr-3 font-medium text-ink-hi">
                          <span className="inline-flex items-center gap-1.5">
                            <AlertTriangle className="h-3.5 w-3.5 text-signal-warn" aria-hidden="true" />
                            {a.username || a.userId}
                          </span>
                        </td>
                        <td className="whitespace-nowrap py-2 pr-3 text-right text-ink-mid">{a.walletBalance}</td>
                        <td className="whitespace-nowrap py-2 pr-3 text-right text-ink-mid">{a.ledgerTotal}</td>
                        <td className="whitespace-nowrap py-2 pr-3 text-right"><Amount value={a.difference} /></td>
                        <td className="py-2 pr-3">
                          <a className="text-neon underline" href={`/admin/users/${a.userId}/wallet-audit`}>Wallet audit</a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
