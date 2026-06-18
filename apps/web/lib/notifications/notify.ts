// Built by Anointed Coder.
//
// Player-facing notification helpers. Each call writes a Notification
// + NotificationRecipient pair so the next /api/me/notifications
// fetch picks it up and the existing site-wide CashbackCelebration
// / NotificationDrawer surfaces it.
//
// kind='cashback' already drives the celebration popup. The new
// kinds shipped here ('deposit_approved', 'withdrawal_approved',
// 'withdrawal_paid', 'promotion_claim') deliberately reuse the
// notification drawer + a small celebration for big-money events;
// non-celebration kinds just live in the drawer with the unread
// badge so the player sees them next time they tap the bell.
//
// All calls are best-effort - a notification write failure is logged
// to the server console but never thrown back to the caller so a
// transient DB issue cannot fail a deposit/withdrawal approval.

import { db } from '@/lib/db/client';

export type NotificationKind =
  | 'cashback'
  | 'deposit_approved'
  | 'deposit_rejected'
  | 'withdrawal_approved'
  | 'withdrawal_paid'
  | 'withdrawal_rejected'
  | 'promotion_claim'
  | 'reward_claim'
  | 'spin_win'
  | 'lotto_win'
  | 'system';

export interface NotifyOpts {
  userId: string;
  kind: NotificationKind;
  titleEn: string;
  titleBn?: string | null;
  bodyEn?: string | null;
  bodyBn?: string | null;
  linkUrl?: string | null;
  imageUrl?: string | null;
  priority?: 'low' | 'normal' | 'high';
}

// Fire-and-forget notification dispatch. Returns the notification id
// on success or null on any error (caller should not depend on it).
export async function notifyUser(opts: NotifyOpts): Promise<string | null> {
  try {
    const n = await db.notification.create({
      data: {
        titleEn: opts.titleEn,
        titleBn: opts.titleBn ?? null,
        bodyEn: opts.bodyEn ?? null,
        bodyBn: opts.bodyBn ?? null,
        linkUrl: opts.linkUrl ?? null,
        imageUrl: opts.imageUrl ?? null,
        priority: opts.priority ?? 'normal',
        status: 'sent',
        audience: 'selected',
        kind: opts.kind,
      },
    });
    await db.notificationRecipient.create({
      data: {
        notificationId: n.id,
        userId: opts.userId,
        deliveredAt: new Date(),
      },
    });
    return n.id;
  } catch (err) {
    console.error('[notify] failed', opts.kind, err);
    return null;
  }
}

function fmt(n: number): string {
  return Number(n).toLocaleString('en-US');
}

// Convenience helpers per event type. Each fills in localised text +
// link target so the call site stays clean.

export async function notifyDepositApproved(input: {
  userId: string;
  amount: number;
  method: string;
  depositId: string;
}): Promise<void> {
  await notifyUser({
    userId: input.userId,
    kind: 'deposit_approved',
    titleEn: `Deposit approved: ${fmt(input.amount)} BDT`,
    titleBn: `ডিপোজিট অনুমোদিত: ${fmt(input.amount)} BDT`,
    bodyEn: `Your ${input.method} deposit has been credited to your wallet. Reference: ${input.depositId.slice(-8)}.`,
    bodyBn: `আপনার ${input.method} ডিপোজিট ওয়ালেটে যোগ হয়েছে। রেফারেন্স: ${input.depositId.slice(-8)}.`,
    linkUrl: '/dashboard/wallet',
    priority: 'high',
  });
}

export async function notifyDepositRejected(input: {
  userId: string;
  amount: number;
  reason: string | null;
  depositId: string;
}): Promise<void> {
  await notifyUser({
    userId: input.userId,
    kind: 'deposit_rejected',
    titleEn: `Deposit rejected: ${fmt(input.amount)} BDT`,
    titleBn: `ডিপোজিট প্রত্যাখ্যাত: ${fmt(input.amount)} BDT`,
    bodyEn: input.reason
      ? `Your deposit was rejected. Reason: ${input.reason}. Contact support if you have questions.`
      : 'Your deposit was rejected. Contact support for details.',
    bodyBn: input.reason
      ? `আপনার ডিপোজিট প্রত্যাখ্যান করা হয়েছে। কারণ: ${input.reason}। প্রশ্ন থাকলে সাপোর্টে যোগাযোগ করুন।`
      : 'আপনার ডিপোজিট প্রত্যাখ্যান করা হয়েছে। বিস্তারিত জানতে সাপোর্টে যোগাযোগ করুন।',
    linkUrl: '/support',
    priority: 'high',
  });
}

export async function notifyWithdrawalApproved(input: {
  userId: string;
  amount: number;
  method: string;
  withdrawalId: string;
}): Promise<void> {
  await notifyUser({
    userId: input.userId,
    kind: 'withdrawal_approved',
    titleEn: `Withdrawal approved: ${fmt(input.amount)} BDT`,
    titleBn: `উইথড্র অনুমোদিত: ${fmt(input.amount)} BDT`,
    bodyEn: `Your ${input.method} withdrawal is approved and queued for payout. You will be notified again once the money is sent.`,
    bodyBn: `আপনার ${input.method} উইথড্র অনুমোদিত হয়েছে এবং পেআউটের জন্য অপেক্ষমান। টাকা পাঠানোর পরে আপনাকে আবার জানানো হবে।`,
    linkUrl: '/dashboard/wallet',
    priority: 'normal',
  });
}

export async function notifyWithdrawalPaid(input: {
  userId: string;
  amount: number;
  method: string;
  withdrawalId: string;
  providerRef?: string | null;
}): Promise<void> {
  await notifyUser({
    userId: input.userId,
    kind: 'withdrawal_paid',
    titleEn: `Withdrawal paid: ${fmt(input.amount)} BDT`,
    titleBn: `উইথড্র সম্পন্ন: ${fmt(input.amount)} BDT`,
    bodyEn: `Your ${input.method} payout has been sent. ${input.providerRef ? `Reference: ${input.providerRef}` : ''}`,
    bodyBn: `আপনার ${input.method} উইথড্র পাঠানো হয়েছে। ${input.providerRef ? `রেফারেন্স: ${input.providerRef}` : ''}`,
    linkUrl: '/dashboard/wallet',
    priority: 'high',
  });
}

export async function notifyWithdrawalRejected(input: {
  userId: string;
  amount: number;
  reason: string | null;
  withdrawalId: string;
}): Promise<void> {
  await notifyUser({
    userId: input.userId,
    kind: 'withdrawal_rejected',
    titleEn: `Withdrawal rejected: ${fmt(input.amount)} BDT`,
    titleBn: `উইথড্র প্রত্যাখ্যাত: ${fmt(input.amount)} BDT`,
    bodyEn: input.reason
      ? `Your withdrawal was rejected and the amount has been refunded. Reason: ${input.reason}.`
      : 'Your withdrawal was rejected and the amount has been refunded.',
    bodyBn: input.reason
      ? `আপনার উইথড্র প্রত্যাখ্যান করা হয়েছে এবং পরিমাণ ফেরত দেওয়া হয়েছে। কারণ: ${input.reason}।`
      : 'আপনার উইথড্র প্রত্যাখ্যান করা হয়েছে এবং পরিমাণ ফেরত দেওয়া হয়েছে।',
    linkUrl: '/dashboard/wallet',
    priority: 'normal',
  });
}

export async function notifyPromotionClaim(input: {
  userId: string;
  promotionName: string;
  amount?: number | null;
}): Promise<void> {
  await notifyUser({
    userId: input.userId,
    kind: 'promotion_claim',
    titleEn: input.amount && input.amount > 0
      ? `Promotion claimed: ${fmt(input.amount)} BDT`
      : `Promotion claimed: ${input.promotionName}`,
    titleBn: input.amount && input.amount > 0
      ? `প্রমোশন গ্রহণ: ${fmt(input.amount)} BDT`
      : `প্রমোশন গ্রহণ: ${input.promotionName}`,
    bodyEn: `Your "${input.promotionName}" promotion has been applied to your account.`,
    bodyBn: `আপনার "${input.promotionName}" প্রমোশন আপনার অ্যাকাউন্টে যোগ হয়েছে।`,
    linkUrl: '/promotions',
    priority: 'high',
  });
}
