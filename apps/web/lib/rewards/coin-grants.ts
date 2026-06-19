// Built by Anointed Coder.
//
// Reward coin grant helpers. Each coin grant lands in Wallet.bonusBalance
// and is surfaced on the /rewards page coin counter. The three event
// hooks here are driven by SystemSetting rows that the operator edits
// at /admin/settings - setting any of them to 0 disables that specific
// grant without touching the others.
//
// Hooks:
//   creditFirstDepositCoinsIfEligible(userId, depositId)
//     -> credits 'reward_coin_first_deposit' coins on the depositor's
//        first approved deposit. Idempotent on depositId.
//
//   creditReferralSuccessfulCoins(referrerId, referredUserId, depositId)
//     -> credits 'reward_coin_referral_successful' coins to the referrer
//        when the referred user's first-deposit reward fires. Idempotent
//        on (referrerId, referredUserId).
//
//   creditReferredFirstDepositCoins(referrerId, referredUserId, depositId)
//     -> credits 'reward_coin_referred_first_deposit' coins to the
//        referrer specifically on the referred friend's first approved
//        deposit. Idempotent on (referrerId, referredUserId).
//
// All grants are fire-and-forget: a failure to grant coins never blocks
// the deposit approval or affiliate accrual. Each one writes:
//   - Wallet.bonusBalance += coins
//   - Transaction(type='reward', description=...) for wallet history
//   - Notification + NotificationRecipient with kind='reward_coin_grant'
//     so the RewardCelebration popup fires on the player's next page
//     load. Idempotency uses Transaction.reference = a stable key.

import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';

const KEY_FIRST_DEPOSIT = 'reward_coin_first_deposit';
const KEY_REFERRAL_SUCCESSFUL = 'reward_coin_referral_successful';
const KEY_REFERRED_FIRST_DEPOSIT = 'reward_coin_referred_first_deposit';

async function loadSetting(key: string, fallback = 0): Promise<number> {
  try {
    const row = await db.systemSetting.findUnique({ where: { key }, select: { value: true } });
    if (!row) return fallback;
    const n = Number(row.value);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  } catch {
    return fallback;
  }
}

interface GrantOpts {
  userId: string;
  coins: number;
  reference: string;     // idempotency key (Transaction.reference)
  description: string;   // human-readable description
  notifyTitleEn: string;
  notifyTitleBn: string;
  notifyBodyEn: string;
  notifyBodyBn: string;
}

// Core credit primitive: increments bonusBalance, writes Transaction +
// Notification, and skips if Transaction.reference already exists for
// this user (idempotency). Returns true if a credit fired, false if
// skipped.
async function creditCoinsOnce(opts: GrantOpts): Promise<boolean> {
  if (opts.coins <= 0) return false;
  try {
    const existing = await db.transaction.findFirst({
      where: { userId: opts.userId, type: 'bonus', reference: opts.reference },
      select: { id: true },
    });
    if (existing) return false;

    await db.$transaction(async (tx) => {
      await tx.wallet.upsert({
        where: { userId: opts.userId },
        update: { bonusBalance: { increment: opts.coins } },
        create: { userId: opts.userId, bonusBalance: opts.coins },
      });
      await tx.transaction.create({
        data: {
          userId: opts.userId,
          type: 'bonus',
          status: 'completed',
          amount: new Prisma.Decimal(opts.coins),
          reference: opts.reference,
          description: opts.description,
          meta: { source: 'reward_coin_grant', reference: opts.reference } as Prisma.JsonObject,
        },
      });
      const n = await tx.notification.create({
        data: {
          titleEn: opts.notifyTitleEn,
          titleBn: opts.notifyTitleBn,
          bodyEn: opts.notifyBodyEn,
          bodyBn: opts.notifyBodyBn,
          linkUrl: '/rewards',
          priority: 'high',
          status: 'sent',
          audience: 'selected',
          kind: 'reward_coin_grant',
        },
      });
      await tx.notificationRecipient.create({
        data: {
          notificationId: n.id,
          userId: opts.userId,
          deliveredAt: new Date(),
        },
      });
    });
    return true;
  } catch (err) {
    console.error('[reward-coins] credit failed', { reference: opts.reference, err });
    return false;
  }
}

function fmtN(n: number): string {
  return n.toLocaleString('en-US');
}

export async function creditFirstDepositCoinsIfEligible(
  userId: string,
  depositId: string,
): Promise<{ credited: boolean; coins: number }> {
  const coins = await loadSetting(KEY_FIRST_DEPOSIT, 0);
  if (coins <= 0) return { credited: false, coins: 0 };

  // First-approved-deposit check. We count any prior approved deposit
  // OTHER than this one to decide eligibility - so re-running the
  // approval flow for the same deposit row never doubles up.
  const priorApproved = await db.deposit.count({
    where: {
      userId,
      status: 'approved',
      id: { not: depositId },
    },
  });
  if (priorApproved > 0) return { credited: false, coins: 0 };

  const credited = await creditCoinsOnce({
    userId,
    coins,
    reference: `reward_coin_first_deposit:${depositId}`,
    description: `Welcome reward: ${fmtN(coins)} coins for your first deposit`,
    notifyTitleEn: `You earned ${fmtN(coins)} reward coins!`,
    notifyTitleBn: `আপনি ${fmtN(coins)} রিওয়ার্ড কয়েন পেয়েছেন!`,
    notifyBodyEn: `Welcome reward for your first deposit. Spend them on /rewards spins or store items.`,
    notifyBodyBn: `প্রথম ডিপোজিটের স্বাগত পুরস্কার। /rewards পেজে স্পিন বা স্টোর আইটেমে ব্যবহার করুন।`,
  });
  return { credited, coins };
}

export async function creditReferralSuccessfulCoins(
  referrerId: string,
  referredUserId: string,
): Promise<{ credited: boolean; coins: number }> {
  const coins = await loadSetting(KEY_REFERRAL_SUCCESSFUL, 0);
  if (coins <= 0) return { credited: false, coins: 0 };

  const credited = await creditCoinsOnce({
    userId: referrerId,
    coins,
    reference: `reward_coin_referral_successful:${referrerId}:${referredUserId}`,
    description: `Successful referral: ${fmtN(coins)} coins`,
    notifyTitleEn: `Referral matured! +${fmtN(coins)} coins`,
    notifyTitleBn: `রেফারেল সফল! +${fmtN(coins)} কয়েন`,
    notifyBodyEn: `One of your referrals reached the deposit threshold. Coins credited to your /rewards balance.`,
    notifyBodyBn: `আপনার একজন রেফারেল ডিপোজিট থ্রেশহোল্ডে পৌঁছেছেন। কয়েন আপনার /rewards ব্যালেন্সে যোগ হয়েছে।`,
  });
  return { credited, coins };
}

export async function creditReferredFirstDepositCoins(
  referrerId: string,
  referredUserId: string,
  depositId: string,
): Promise<{ credited: boolean; coins: number }> {
  const coins = await loadSetting(KEY_REFERRED_FIRST_DEPOSIT, 0);
  if (coins <= 0) return { credited: false, coins: 0 };

  const credited = await creditCoinsOnce({
    userId: referrerId,
    coins,
    reference: `reward_coin_referred_first_deposit:${referrerId}:${referredUserId}:${depositId}`,
    description: `Referred friend's first deposit: ${fmtN(coins)} coins`,
    notifyTitleEn: `Your referral made their first deposit! +${fmtN(coins)} coins`,
    notifyTitleBn: `আপনার রেফারেল প্রথম ডিপোজিট করেছেন! +${fmtN(coins)} কয়েন`,
    notifyBodyEn: `Bonus coins for bringing in a new active player. Visit /rewards to spend them.`,
    notifyBodyBn: `নতুন একজন সক্রিয় খেলোয়াড় আনার জন্য বোনাস কয়েন। /rewards পেজে ব্যয় করুন।`,
  });
  return { credited, coins };
}
