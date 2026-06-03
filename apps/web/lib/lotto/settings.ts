// Built by Anointed Coder.
//
// Lotto settings loader. All values read through loadLottoSettings so
// admin changes propagate without code edits. Defaults match the
// historical hard-coded values so a fresh DB without seed entries
// still behaves identically.
//
// Keys:
//   lotto_enabled                'true' | 'false'   default 'true'
//   lotto_claim_mode             'auto' | 'manual'  default 'auto'
//   lotto_ticket_rate_amount     Integer >= 100     default 1200
//   lotto_ticket_rate_count      Integer >= 1       default 2
//   lotto_cutoff_minutes         Integer >= 0       default 10
//                                 Tickets generated within this many
//                                 minutes of drawsAt do NOT join that
//                                 draw - they wait for the next one.
//   lotto_mult_first             default 2000
//   lotto_mult_second            default 800
//   lotto_mult_third             default 300
//   lotto_mult_special           default 150
//   lotto_mult_consolation       default 30
//                                 Operator-controlled default
//                                 multipliers, used by the settle
//                                 endpoint when no per-draw override
//                                 is provided.

import { db } from '@/lib/db/client';

export interface LottoSettings {
  enabled: boolean;
  claimMode: 'auto' | 'manual';
  ticketRateAmount: number;
  ticketRateCount: number;
  cutoffMinutes: number;
  multFirst: number;
  multSecond: number;
  multThird: number;
  multSpecial: number;
  multConsolation: number;
}

const KEYS = [
  'lotto_enabled',
  'lotto_claim_mode',
  'lotto_ticket_rate_amount',
  'lotto_ticket_rate_count',
  'lotto_cutoff_minutes',
  'lotto_mult_first',
  'lotto_mult_second',
  'lotto_mult_third',
  'lotto_mult_special',
  'lotto_mult_consolation',
] as const;

function intOr(raw: string | undefined, fallback: number, min = 0): number {
  if (raw == null) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min) return fallback;
  return Math.floor(n);
}

export async function loadLottoSettings(): Promise<LottoSettings> {
  const rows = await db.systemSetting.findMany({ where: { key: { in: KEYS as unknown as string[] } } });
  const get = (k: string) => rows.find((r) => r.key === k)?.value;

  const enabledRaw = (get('lotto_enabled') ?? 'true').toLowerCase();
  const claimRaw = (get('lotto_claim_mode') ?? 'auto').toLowerCase();
  const rateAmountRaw = Number(get('lotto_ticket_rate_amount') ?? 1200);
  const rateCountRaw = Number(get('lotto_ticket_rate_count') ?? 2);

  return {
    enabled: enabledRaw === 'true',
    claimMode: claimRaw === 'manual' ? 'manual' : 'auto',
    ticketRateAmount: Number.isFinite(rateAmountRaw) && rateAmountRaw >= 100 ? Math.floor(rateAmountRaw) : 1200,
    ticketRateCount: Number.isFinite(rateCountRaw) && rateCountRaw >= 1 ? Math.floor(rateCountRaw) : 2,
    cutoffMinutes: intOr(get('lotto_cutoff_minutes'), 10, 0),
    multFirst: intOr(get('lotto_mult_first'), 2000, 1),
    multSecond: intOr(get('lotto_mult_second'), 800, 1),
    multThird: intOr(get('lotto_mult_third'), 300, 1),
    multSpecial: intOr(get('lotto_mult_special'), 150, 1),
    multConsolation: intOr(get('lotto_mult_consolation'), 30, 1),
  };
}

// Shared helper for whether the public Pasha Originals strip / native
// game routes should render. Default OFF so the platform shows only
// real provider games until the operator flips the flag.
const NATIVE_PUBLIC_FLAG = 'native_games_public_enabled';

export async function isNativePublicEnabled(): Promise<boolean> {
  const row = await db.systemSetting.findUnique({ where: { key: NATIVE_PUBLIC_FLAG } });
  if (!row) return false;
  return (row.value ?? '').toLowerCase() === 'true';
}
