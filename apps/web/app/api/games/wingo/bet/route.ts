// Built by Anointed Coder.
//
// Pasha WinGo bet placement. Authenticated. A player may stake several
// bet lines on the current round of a mode in one request; the whole
// slip debits the wallet once and creates every WingoBet inside a single
// transaction (lib/wingo/placement.ts). Bet close is enforced
// server-side: a bet at or after betCloseAt is rejected, never merely
// hidden by the UI. Turnover is accrued AFTER the transaction commits so
// a bonus fault can never roll back the bet.
//
// POST /api/games/wingo/bet
//   Body:
//     {
//       mode: "wingo_30s" | "wingo_1m" | "wingo_3m" | "wingo_5m",
//       bets: [ { betType, selection, stake, quantity }, ... ],
//       idempotencyKey?: string
//     }
//   A single-line shorthand { mode, betType, selection, stake, quantity }
//   is also accepted.
//   betType: "color" | "number" | "size"
//   selection: green|red|violet  |  "0".."9"  |  big|small
//   stake: unit stake (>= min). quantity: X1..X100. Per-line total
//   (stake * quantity) must be <= max.
//
// Response: { ok, balance, roundId, periodNumber, mode, betCloseAt,
//   drawsAt, totalStake, reused, bets: [ { betId, betType, selection,
//   stake, quantity, betAmount } ] }.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, recordActivity } from '@/lib/auth/guard';
import { requireActiveUser } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { rateLimit } from '@/lib/auth/rate-limit';
import { isWingoMode, WINGO_GAME_CODE, WINGO_RATE_MAX, WINGO_RATE_WINDOW_MS, type WingoMode } from '@/lib/wingo/config';
import { loadWingoSettings } from '@/lib/wingo/flag';
import { placeBets, WINGO_PLACEMENT_ERRORS } from '@/lib/wingo/placement';
import { WINGO_ERRORS } from '@/lib/wingo/engine';
import { addTurnover } from '@/lib/bonuses/engine';

const lineSchema = z.object({
  betType: z.enum(['color', 'number', 'size']),
  selection: z.string().trim().min(1).max(16),
  stake: z.coerce.number().positive().max(10_000_000),
  quantity: z.coerce.number().int().min(1).max(100),
});

const bodySchema = z.union([
  z.object({
    mode: z.string().trim().min(1),
    bets: z.array(lineSchema).min(1).max(20),
    idempotencyKey: z.string().trim().max(96).optional(),
  }),
  // Single-line shorthand.
  z.object({
    mode: z.string().trim().min(1),
    betType: z.enum(['color', 'number', 'size']),
    selection: z.string().trim().min(1).max(16),
    stake: z.coerce.number().positive().max(10_000_000),
    quantity: z.coerce.number().int().min(1).max(100),
    idempotencyKey: z.string().trim().max(96).optional(),
  }),
]);

// Bilingual error map. `message` is English; meta.messageBn is Bangla.
const ERR_MAP: Record<string, { status: number; en: string; bn: string }> = {
  [WINGO_ERRORS.INVALID_MODE]: { status: 400, en: 'Unknown WinGo mode.', bn: 'অজানা উইনগো মোড।' },
  [WINGO_ERRORS.INVALID_BET_TYPE]: { status: 400, en: 'Invalid bet type.', bn: 'ভুল বাজির ধরন।' },
  [WINGO_ERRORS.INVALID_SELECTION]: { status: 400, en: 'Invalid selection for this bet type.', bn: 'এই বাজির জন্য ভুল নির্বাচন।' },
  [WINGO_ERRORS.INVALID_QUANTITY]: { status: 400, en: 'Quantity must be between 1 and 100.', bn: 'পরিমাণ ১ থেকে ১০০ এর মধ্যে হতে হবে।' },
  [WINGO_ERRORS.STAKE_BELOW_MIN]: { status: 400, en: 'Stake is below the minimum.', bn: 'বাজি সর্বনিম্ন সীমার নিচে।' },
  [WINGO_ERRORS.STAKE_ABOVE_MAX]: { status: 400, en: 'Stake exceeds the maximum for one line.', bn: 'বাজি এক লাইনের সর্বোচ্চ সীমা ছাড়িয়ে গেছে।' },
  [WINGO_ERRORS.BET_CLOSED]: { status: 409, en: 'Betting for this round is closed. Wait for the next round.', bn: 'এই রাউন্ডের বাজি বন্ধ হয়ে গেছে। পরের রাউন্ডের জন্য অপেক্ষা করুন।' },
  [WINGO_ERRORS.ROUND_NOT_FOUND]: { status: 404, en: 'Round not found.', bn: 'রাউন্ড পাওয়া যায়নি।' },
  [WINGO_ERRORS.ROUND_NOT_READY]: { status: 409, en: 'Round is not ready.', bn: 'রাউন্ড এখনও প্রস্তুত নয়।' },
  [WINGO_ERRORS.WALLET_NOT_FOUND]: { status: 404, en: 'Wallet not found.', bn: 'ওয়ালেট পাওয়া যায়নি।' },
  [WINGO_ERRORS.INSUFFICIENT_FUNDS]: { status: 400, en: 'Wallet balance is lower than the total stake.', bn: 'ওয়ালেট ব্যালেন্স মোট বাজির চেয়ে কম।' },
  [WINGO_PLACEMENT_ERRORS.NO_LINES]: { status: 400, en: 'Add at least one bet.', bn: 'অন্তত একটি বাজি যোগ করুন।' },
  [WINGO_PLACEMENT_ERRORS.TOO_MANY_LINES]: { status: 400, en: 'Too many bet lines in one request.', bn: 'এক অনুরোধে অনেক বেশি বাজি লাইন।' },
};

function mapError(msg: string) {
  const known = ERR_MAP[msg];
  if (known) return jsonError(known.status, msg, known.en, { messageBn: known.bn });
  console.error('[wingo] unexpected bet error', msg);
  return jsonError(500, 'SERVER_ERROR', 'Something went wrong. Please try again.', { messageBn: 'কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।' });
}

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const auth = await requireActiveUser();

    const limit = rateLimit(`wingo-bet:${auth.sub}`, WINGO_RATE_MAX, WINGO_RATE_WINDOW_MS);
    if (!limit.ok) return jsonError(429, 'RATE_LIMITED', 'Too many bets too fast. Slow down a moment.', { messageBn: 'খুব দ্রুত অনেক বাজি। একটু ধীরে করুন।' });

    const body = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, 'VALIDATION', 'Check your bet details.', { messageBn: 'আপনার বাজির তথ্য যাচাই করুন।', issues: parsed.error.issues });
    }

    const data = parsed.data;
    if (!isWingoMode(data.mode)) {
      return jsonError(400, WINGO_ERRORS.INVALID_MODE, 'Unknown WinGo mode.', { messageBn: 'অজানা উইনগো মোড।' });
    }
    const mode = data.mode as WingoMode;

    // Enable gates: the game ships disabled and stays disabled per mode
    // until an admin turns it on. Every /api/games/wingo* route honours
    // this, so a closed mode never accepts a wager.
    const settings = await loadWingoSettings();
    if (!settings.enabled) {
      return jsonError(503, 'WINGO_DISABLED', 'WinGo is currently unavailable.', { messageBn: 'উইনগো এখন উপলব্ধ নয়।' });
    }
    if (!settings.modes[mode]) {
      return jsonError(503, 'WINGO_MODE_DISABLED', 'This WinGo mode is currently unavailable.', { messageBn: 'এই উইনগো মোড এখন উপলব্ধ নয়।' });
    }

    const lines = 'bets' in data
      ? data.bets
      : [{ betType: data.betType, selection: data.selection, stake: data.stake, quantity: data.quantity }];

    try {
      const result = await placeBets({
        userId: auth.sub,
        mode,
        lines,
        minStake: settings.minStake,
        maxStake: settings.maxStake,
        idempotencyKey: data.idempotencyKey,
      });

      if (!result.reused && result.totalStake > 0) {
        // Fire-and-forget turnover accrual, after commit, so a bonus
        // fault cannot roll back the bet. Same pattern as native games.
        addTurnover({
          userId: auth.sub,
          amount: result.totalStake,
          kind: 'native_game',
          reference: result.roundId,
          meta: { gameCode: WINGO_GAME_CODE, mode },
        }).catch((err) => console.error('[wingo] addTurnover failed', err));

        await recordActivity({
          actorId: auth.sub,
          actorRole: auth.role,
          action: 'NATIVE_BET',
          target: result.roundId,
          meta: {
            gameCode: WINGO_GAME_CODE,
            mode,
            periodNumber: result.periodNumber,
            totalStake: result.totalStake,
            lineCount: result.bets.length,
          },
        });
      }

      return jsonOk(
        {
          balance: result.newBalance,
          roundId: result.roundId,
          periodNumber: result.periodNumber,
          mode: result.mode,
          betCloseAt: result.betCloseAt,
          drawsAt: result.drawsAt,
          totalStake: result.totalStake,
          reused: result.reused,
          bets: result.bets,
        },
        201,
      );
    } catch (err) {
      return mapError(err instanceof Error ? err.message : String(err));
    }
  });
}
