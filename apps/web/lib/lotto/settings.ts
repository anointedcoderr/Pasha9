// Built by Anointed Coder.
//
// M4 Phase F lotto settings loader. Four SystemSetting keys drive the
// admin-controlled knobs:
//
//   lotto_enabled            'true' | 'false'
//                            When 'false' the public lotto page and
//                            ticket accrual no-op. Default 'true'.
//   lotto_claim_mode         'auto' | 'manual'
//                            'auto' (default) credits Wallet.lottoBalance
//                            instantly on settle. 'manual' writes
//                            LotteryWinning rows with status='pending_credit'
//                            and the player claims each ticket via
//                            /api/lotto/winnings/[id]/claim.
//   lotto_ticket_rate_amount Integer >= 100. Default 1200.
//   lotto_ticket_rate_count  Integer >= 1. Default 2.
//                            (1200 BDT of approved deposits earns 2 tickets.)
//
// All consumers read through loadLottoSettings so changes propagate
// without code edits. Defaults match the M2F hardcoded values so a
// fresh DB without Phase F seed entries still behaves identically.

import { db } from '@/lib/db/client';

export interface LottoSettings {
  enabled: boolean;
  claimMode: 'auto' | 'manual';
  ticketRateAmount: number;
  ticketRateCount: number;
}

const KEYS = [
  'lotto_enabled',
  'lotto_claim_mode',
  'lotto_ticket_rate_amount',
  'lotto_ticket_rate_count',
] as const;

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
  };
}
