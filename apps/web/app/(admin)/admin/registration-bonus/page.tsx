// Built by Anointed Coder.
//
// Registration Bonus System. Every field the client specified, in one screen:
// amount, maximum winning limit, required deposit percent, turnover rule,
// eligible games, on/off and locked winnings.
//
// The worked example updates as the operator types. These settings interact
// (a percent of an amount, a cap on winnings, a multiplier for turnover), and
// stating the outcome in words is the difference between configuring this
// confidently and guessing.

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/Input';
import { NumericInput } from '@/components/ui/NumericInput';
import { Switch } from '@/components/ui/Switch';
import { Gift, Save, Check } from 'lucide-react';

interface Config {
  enabled: boolean;
  amount: number;
  maxWinning: number;
  requiredDepositPercent: number;
  turnoverMultiplier: number;
  eligibleGames: string;
  lockWinnings: boolean;
}

const EMPTY: Config = {
  enabled: false,
  amount: 0,
  maxWinning: 0,
  requiredDepositPercent: 0,
  turnoverMultiplier: 0,
  eligibleGames: '',
  lockWinnings: true,
};

export default function RegistrationBonusPage() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch('/api/admin/registration-bonus', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Failed to load');
      setCfg({ ...EMPTY, ...(j.config as Config) });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setCfg({ ...EMPTY });
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const set = <K extends keyof Config>(key: K, value: Config[K]) =>
    setCfg((c) => (c ? { ...c, [key]: value } : c));

  const save = async () => {
    if (!cfg) return;
    setSaving(true);
    setError(null);
    setSavedAt(null);
    try {
      const r = await fetch('/api/admin/registration-bonus', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(cfg),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Save failed');
      setSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // Says out loud what the numbers add up to, so the operator is never
  // guessing at how the fields combine.
  const example = useMemo(() => {
    if (!cfg || !cfg.enabled || cfg.amount <= 0) return null;
    const needed = (cfg.amount * cfg.requiredDepositPercent) / 100;
    const turnover = cfg.amount * cfg.turnoverMultiplier;
    return {
      needed: needed.toFixed(2),
      turnover: turnover.toFixed(2),
      cap: cfg.maxWinning > 0 ? cfg.maxWinning.toFixed(2) : null,
    };
  }, [cfg]);

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        icon={<Gift className="h-5 w-5" />}
        title="Registration Bonus"
        subtitle="Credit a bonus when a player registers, held until they deposit."
      />

      {cfg === null ? (
        <Card padding="lg"><p className="text-sm text-ink-mid">Loading...</p></Card>
      ) : (
        <>
          <Card padding="lg">
            <CardHeader
              title="Bonus rules"
              subtitle="Off by default. Nothing is credited to anyone until you switch this on."
            />

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 border-b border-neon/10 pb-4">
                <div>
                  <p className="text-sm font-medium text-ink-hi">Registration bonus</p>
                  <p className="text-xs text-ink-lo">Credited automatically when a new player registers.</p>
                </div>
                <Switch checked={cfg.enabled} onChange={(v) => set('enabled', v)} label="Enable registration bonus" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Bonus amount (BDT)" hint="Credited at sign-up.">
                  <NumericInput min={0} step="0.01" value={cfg.amount} onValueChange={(n) => set('amount', n)} />
                </FormField>

                <FormField label="Maximum winning limit (BDT)" hint="Most a player can keep from this bonus. 0 means no limit.">
                  <NumericInput min={0} step="0.01" value={cfg.maxWinning} onValueChange={(n) => set('maxWinning', n)} />
                </FormField>

                <FormField
                  label="Required deposit (%)"
                  hint="Percent OF THE BONUS AMOUNT the player must deposit before their winnings unlock."
                >
                  <NumericInput min={0} step="1" value={cfg.requiredDepositPercent} onValueChange={(n) => set('requiredDepositPercent', n)} />
                </FormField>

                <FormField label="Turnover multiplier" hint="Wagering requirement is the bonus amount times this. 0 means none.">
                  <NumericInput min={0} step="0.1" value={cfg.turnoverMultiplier} onValueChange={(n) => set('turnoverMultiplier', n)} />
                </FormField>
              </div>

              <FormField
                label="Eligible games"
                hint="Game IDs separated by commas, e.g. 737, 879. Leave blank to allow every game to count."
              >
                <Input
                  value={cfg.eligibleGames}
                  onChange={(e) => set('eligibleGames', e.target.value)}
                  placeholder="Leave blank for all games"
                />
              </FormField>

              <div className="flex items-center justify-between gap-4 border-t border-neon/10 pt-4">
                <div>
                  <p className="text-sm font-medium text-ink-hi">Lock winnings until the deposit requirement is met</p>
                  <p className="text-xs text-ink-lo">
                    Recommended. Turning this off hands the bonus over as spendable money immediately, with no deposit
                    required and nothing to unlock.
                  </p>
                </div>
                <Switch checked={cfg.lockWinnings} onChange={(v) => set('lockWinnings', v)} label="Lock winnings" />
              </div>
            </div>
          </Card>

          {example ? (
            <Card padding="lg" className="mt-4">
              <CardHeader title="What a player will experience" />
              <ol className="list-inside list-decimal space-y-1 text-sm text-ink-mid">
                <li>Registers and is credited <strong className="text-ink-hi">{cfg.amount.toFixed(2)}</strong>, {cfg.lockWinnings ? 'held and not withdrawable' : 'spendable immediately'}.</li>
                {cfg.lockWinnings ? (
                  <li>Must deposit <strong className="text-ink-hi">{example.needed}</strong> ({cfg.requiredDepositPercent}% of the bonus) before their winnings unlock.</li>
                ) : null}
                {cfg.turnoverMultiplier > 0 ? (
                  <li>Must wager <strong className="text-ink-hi">{example.turnover}</strong> to satisfy the turnover requirement.</li>
                ) : null}
                {example.cap ? (
                  <li>Can keep at most <strong className="text-ink-hi">{example.cap}</strong>. Anything above that is forfeited when the bonus unlocks.</li>
                ) : <li>No maximum winning limit is set, so nothing is forfeited.</li>}
                <li>{cfg.eligibleGames.trim() ? <>Only these games count toward the requirement: <strong className="text-ink-hi">{cfg.eligibleGames}</strong>.</> : 'Every game counts toward the requirement.'}</li>
              </ol>
            </Card>
          ) : null}

          {error ? <p className="mt-4 text-sm text-signal-danger" role="alert">{error}</p> : null}

          <div className="mt-6 flex items-center justify-end gap-3">
            {savedAt ? (
              <span role="status" className="inline-flex items-center gap-1 text-sm text-signal-ok">
                <Check className="h-3.5 w-3.5" aria-hidden="true" /> Saved
              </span>
            ) : null}
            <Button onClick={save} loading={saving} leftIcon={<Save className="h-3.5 w-3.5" />}>
              Save registration bonus
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
