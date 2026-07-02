// Built by Anointed Coder.
//
// Admin user details drawer. Reads the rich /api/admin/users/[id]
// payload (profile, role, wallet, referredBy snapshot, lifetime
// deposit / withdrawal aggregates, lottery counts, session count)
// and exposes the existing Adjust Balance action alongside an
// account status toggle. The block-reason question runs through an
// in-page modal: the native window.prompt() this drawer used before
// is silently suppressed in installed PWAs / in-app webviews, so
// flipping the switch looked completely dead.

'use client';

import { useState } from 'react';
import { Drawer, Modal } from '@/components/ui/Modal';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { FormField, Textarea } from '@/components/ui/Input';
import { formatBDT, formatDate, formatDateTime } from '@/lib/utils/format';
import { useLang } from '@/lib/i18n/context';
import { Lock, Unlock, AlertCircle } from 'lucide-react';

export interface AdminUserSummary {
  id: string;
  username: string;
  phone: string;
  status: 'active' | 'blocked' | 'pending';
  roleKey: string;
  roleLabel?: string;
  country: string;
  language: 'bn' | 'en';
  createdAt: string;
  balance: number;
}

export interface AdminUserDetail {
  id: string;
  username: string;
  phone: string;
  email?: string | null;
  avatarUrl?: string | null;
  role: { key: string; label: string };
  status: 'active' | 'blocked' | 'pending';
  blockedReason?: string | null;
  blockedAt?: string | null;
  country: string;
  language: 'bn' | 'en';
  referralCode: string;
  referredBy: { id: string; username: string; referralCode: string } | null;
  isAffiliate: boolean;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  phoneVerifiedAt: string | null;
  createdAt: string;
  wallet: {
    balance: number;
    bonusBalance: number;
    lockedBalance: number;
    lottoBalance: number;
    currency: string;
  };
  totals: {
    deposit: number;
    withdraw: number;
    depositsApprovedCount: number;
    withdrawalsApprovedCount: number;
    lotteryTickets: number;
    lotteryWinnings: number;
    sessionCount: number;
  };
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  detail: AdminUserDetail | null;
  loading: boolean;
  error: string | null;
  onAdjustBalance: (u: AdminUserSummary) => void;
  onStatusChange: (next: 'active' | 'blocked', reason?: string) => void;
}

export function UserDetailDrawer({ open, onOpenChange, detail, loading, error, onAdjustBalance, onStatusChange }: Props) {
  const { lang } = useLang();

  // In-page block-reason dialog. Replaces the suppressed window.prompt().
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockReason, setBlockReason] = useState('');

  const title = detail?.username ?? (loading ? 'Loading...' : 'User');
  const description = detail?.phone ?? '';

  return (
    <Drawer open={open} onOpenChange={onOpenChange} title={title} description={description} width="460px">
      {error ? (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {!detail && loading ? (
        <p className="text-sm text-ink-mid">Loading user...</p>
      ) : !detail ? (
        <p className="text-sm text-ink-mid">No user selected.</p>
      ) : (
        <div className="space-y-5">
          {/* Identity header with player-uploaded avatar */}
          <div className="flex items-center gap-3 rounded-xl border border-neon/10 bg-base-deep/40 p-3">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-neon/20 bg-grad-gold text-base-deep">
              {detail.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={detail.avatarUrl}
                  alt={detail.username}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-base font-bold">
                  {initialsOf(detail.username)}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-ink-hi">{detail.username}</p>
              <p className="truncate text-xs text-ink-mid">{detail.phone}</p>
              {detail.email ? <p className="truncate text-[11px] text-ink-lo">{detail.email}</p> : null}
            </div>
          </div>

          {/* Account status + lock/unlock */}
          <div className="rounded-xl border border-neon/10 bg-base-deep/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {detail.status === 'blocked' ? <Lock className="h-4 w-4 text-red-600" /> : <Unlock className="h-4 w-4 text-emerald-500" />}
                <div>
                  <p className="text-xs text-ink-lo">Account status</p>
                  <p className="text-sm font-bold capitalize text-ink-hi">{detail.status}</p>
                </div>
              </div>
              <Switch
                tone={detail.status === 'blocked' ? 'danger' : 'brand'}
                checked={detail.status === 'active'}
                onChange={(next) => {
                  if (next) {
                    onStatusChange('active');
                  } else {
                    // Ask for the block reason in an in-page modal.
                    // Empty value still blocks; admin can leave it blank.
                    setBlockReason(detail.blockedReason ?? '');
                    setBlockOpen(true);
                  }
                }}
                label={detail.status === 'active' ? 'Block account' : 'Unblock account'}
              />
            </div>
            {detail.status === 'blocked' && (detail.blockedReason || detail.blockedAt) ? (
              <div className="mt-3 space-y-1 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {detail.blockedReason ? (
                  <p>
                    <span className="font-bold">Reason: </span>
                    {detail.blockedReason}
                  </p>
                ) : null}
                {detail.blockedAt ? (
                  <p className="text-red-700/80">
                    Blocked at {formatDateTime(detail.blockedAt, lang)}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Identity */}
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Username" value={<code className="font-mono">{detail.username}</code>} />
            <Field label="Phone" value={<code className="font-mono">{detail.phone}</code>} />
            <Field label="Email" value={detail.email ?? <span className="text-ink-mid">Not set</span>} />
            <Field
              label="Role"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <Chip tone={detail.role.key === 'super_admin' ? 'ok' : detail.role.key === 'admin' ? 'warn' : 'info'}>
                    {detail.role.key.replace('_', ' ')}
                  </Chip>
                </span>
              }
            />
            <Field label="Country" value={detail.country} />
            <Field label="Language" value={detail.language === 'bn' ? 'Bangla' : 'English'} />
            <Field label="Created" value={formatDate(detail.createdAt, lang)} />
            <Field
              label="Last login"
              value={detail.lastLoginAt ? formatDateTime(detail.lastLoginAt, lang) : <span className="text-ink-mid">Never</span>}
            />
            <Field
              label="Last login IP"
              value={detail.lastLoginIp ? <code className="font-mono text-xs">{detail.lastLoginIp}</code> : <span className="text-ink-mid">Unknown</span>}
            />
            <Field
              label="Phone verified"
              value={detail.phoneVerifiedAt ? <Chip tone="ok">Verified</Chip> : <Chip tone="warn">Not verified</Chip>}
            />
            <Field label="Referral code" value={<code className="font-mono text-xs">{detail.referralCode}</code>} />
            <Field
              label="Referred by"
              value={
                detail.referredBy ? (
                  <span className="text-xs">
                    <span className="font-semibold text-ink-hi">{detail.referredBy.username}</span>
                    <span className="ml-1 text-ink-lo">(<code className="font-mono">{detail.referredBy.referralCode}</code>)</span>
                  </span>
                ) : (
                  <Chip>Direct</Chip>
                )
              }
            />
            <Field
              label="Affiliate"
              value={detail.isAffiliate ? <Chip tone="ok">Member</Chip> : <Chip>No</Chip>}
            />
            <Field label="Sessions" value={`${detail.totals.sessionCount} on record`} />
          </dl>

          {/* Wallet balances */}
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-ink-lo">Wallet</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Stat label="Main balance" value={formatBDT(detail.wallet.balance)} tone="gold" />
              <Stat label="Bonus balance" value={formatBDT(detail.wallet.bonusBalance)} tone="neon" />
              <Stat label="Locked balance" value={formatBDT(detail.wallet.lockedBalance)} tone="cool" />
              <Stat label="Lotto balance" value={formatBDT(detail.wallet.lottoBalance)} tone="gold" />
            </div>
          </div>

          {/* Lifetime money totals */}
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-ink-lo">Lifetime totals</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Stat
                label={`Total deposit · ${detail.totals.depositsApprovedCount}`}
                value={formatBDT(detail.totals.deposit)}
                tone="cool"
              />
              <Stat
                label={`Total withdrawal · ${detail.totals.withdrawalsApprovedCount}`}
                value={formatBDT(detail.totals.withdraw)}
                tone="cool"
              />
              <Stat label="Lottery tickets" value={detail.totals.lotteryTickets.toLocaleString()} tone="cool" />
              <Stat label="Lottery wins" value={detail.totals.lotteryWinnings.toLocaleString()} tone="cool" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={() =>
                onAdjustBalance({
                  id: detail.id,
                  username: detail.username,
                  phone: detail.phone,
                  status: detail.status,
                  roleKey: detail.role.key,
                  roleLabel: detail.role.label,
                  country: detail.country,
                  language: detail.language,
                  createdAt: detail.createdAt,
                  balance: detail.wallet.balance,
                })
              }
              className="flex-1"
            >
              Adjust Balance
            </Button>
          </div>
          <p className="text-[11px] text-ink-lo">
            Adjust Balance writes via the existing admin balance adjustment surface. Player-requested
            password resets are reviewed from the Password Resets page.
          </p>
        </div>
      )}

      <Modal
        open={blockOpen}
        onOpenChange={setBlockOpen}
        title="Block account"
        description={detail ? `${detail.username} will be locked out until unblocked.` : ''}
        size="sm"
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            setBlockOpen(false);
            onStatusChange('blocked', blockReason.trim());
          }}
        >
          <FormField
            label="Reason (shown to the user, optional)"
            hint="কারণটি ব্যবহারকারীকে দেখানো হবে। ফাঁকা রাখলেও অ্যাকাউন্ট ব্লক হবে।"
          >
            <Textarea
              rows={3}
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="Example: Multiple accounts detected"
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setBlockOpen(false)}>Cancel</Button>
            <Button type="submit" variant="danger">Block account</Button>
          </div>
        </form>
      </Modal>
    </Drawer>
  );
}

function initialsOf(name: string): string {
  return name
    .split(/[\s_.-]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neon/10 bg-base-deep/40 p-3">
      <dt className="text-[11px] uppercase tracking-wider text-ink-lo">{label}</dt>
      <dd className="mt-1 text-ink-hi">{value}</dd>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: 'gold' | 'neon' | 'cool' }) {
  const map = { gold: 'ring-gold-soft', neon: 'ring-neon-soft', cool: 'border-neon/15' } as const;
  return (
    <div className={`rounded-xl border bg-base-deep/40 p-3 ${map[tone]}`}>
      <p className="text-[11px] uppercase tracking-wider text-ink-lo">{label}</p>
      <p className={tone === 'gold' ? 'mt-1 font-semibold text-gradient-gold' : 'mt-1 font-semibold text-ink-hi'}>{value}</p>
    </div>
  );
}
