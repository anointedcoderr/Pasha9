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
  | 'system'
  // Admin-targeted kinds. The admin bell at /admin filters its feed
  // to rows whose kind starts with 'admin_' so a staff user who also
  // tests the player flow on the same account does not see player
  // celebration popups in the admin shell.
  | 'admin_deposit_pending'
  | 'admin_withdrawal_pending'
  | 'admin_reward_claim_pending'
  | 'admin_affiliate_application_pending'
  | 'admin_promotion_claim_pending';

// Role keys that should receive admin-targeted notifications. Kept in
// sync with STAFF_ROLES in lib/auth/rbac.ts so the people who can
// review pending items are exactly the people who get pinged.
const ADMIN_NOTIFY_ROLES = ['super_admin', 'admin', 'staff'] as const;

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

// ----- Admin-targeted notifications (bell at /admin) ----------------

export interface NotifyAdminsOpts {
  kind: NotificationKind;
  titleEn: string;
  titleBn?: string | null;
  bodyEn?: string | null;
  bodyBn?: string | null;
  linkUrl?: string | null;
  priority?: 'low' | 'normal' | 'high';
}

// Fans out a single Notification row to every staff user (super_admin,
// admin, staff) by writing one NotificationRecipient per admin. Fire-
// and-forget so a transient DB error on the notify path can never fail
// the player-facing submit that triggered it.
//
// If the staff table is empty the call is a no-op. If the
// NotificationRecipient bulk insert partially fails, the Notification
// row stays in place and the audit trail still shows the event - just
// without the bell ping. We log so we can investigate later.
export async function notifyAdmins(opts: NotifyAdminsOpts): Promise<string | null> {
  try {
    const admins = await db.user.findMany({
      where: { role: { key: { in: [...ADMIN_NOTIFY_ROLES] } } },
      select: { id: true },
    });
    if (admins.length === 0) return null;

    const n = await db.notification.create({
      data: {
        titleEn: opts.titleEn,
        titleBn: opts.titleBn ?? null,
        bodyEn: opts.bodyEn ?? null,
        bodyBn: opts.bodyBn ?? null,
        linkUrl: opts.linkUrl ?? null,
        priority: opts.priority ?? 'normal',
        status: 'sent',
        audience: 'admins',
        kind: opts.kind,
      },
    });

    const now = new Date();
    const CHUNK = 200;
    for (let i = 0; i < admins.length; i += CHUNK) {
      await db.notificationRecipient.createMany({
        data: admins.slice(i, i + CHUNK).map((a) => ({
          notificationId: n.id,
          userId: a.id,
          deliveredAt: now,
        })),
        skipDuplicates: true,
      });
    }
    return n.id;
  } catch (err) {
    console.error('[notifyAdmins] failed', opts.kind, err);
    return null;
  }
}

function shortRef(id: string): string {
  return id.slice(-8);
}

// Resolves a friendly handle for the player in admin bell text.
// Falls back to a generic "A player" string so the notification still
// reads cleanly when the lookup fails or the user has no display name.
async function resolvePlayerHandle(userId: string): Promise<string> {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { username: true, phone: true },
    });
    if (!user) return 'A player';
    const handle = (user.username ?? user.phone ?? '').trim();
    return handle.length > 0 ? handle : 'A player';
  } catch {
    return 'A player';
  }
}

export async function notifyAdminsDepositPending(input: {
  depositId: string;
  amount: number;
  method: string;
  userId: string;
}): Promise<void> {
  const who = await resolvePlayerHandle(input.userId);
  await notifyAdmins({
    kind: 'admin_deposit_pending',
    titleEn: `New deposit: ${fmt(input.amount)} BDT (${input.method})`,
    titleBn: `নতুন ডিপোজিট: ${fmt(input.amount)} BDT (${input.method})`,
    bodyEn: `${who} submitted a ${fmt(input.amount)} BDT deposit via ${input.method}. Ref ${shortRef(input.depositId)}. Review at /admin/deposits.`,
    bodyBn: `${who} ${input.method}-এর মাধ্যমে ${fmt(input.amount)} BDT ডিপোজিট জমা দিয়েছেন। Ref ${shortRef(input.depositId)}.`,
    linkUrl: '/admin/deposits',
    priority: 'high',
  });
}

export async function notifyAdminsWithdrawalPending(input: {
  withdrawalId: string;
  amount: number;
  method: string;
  userId: string;
}): Promise<void> {
  const who = await resolvePlayerHandle(input.userId);
  await notifyAdmins({
    kind: 'admin_withdrawal_pending',
    titleEn: `New withdrawal: ${fmt(input.amount)} BDT (${input.method})`,
    titleBn: `নতুন উইথড্র: ${fmt(input.amount)} BDT (${input.method})`,
    bodyEn: `${who} requested a ${fmt(input.amount)} BDT withdrawal via ${input.method}. Ref ${shortRef(input.withdrawalId)}. Review at /admin/withdrawals.`,
    bodyBn: `${who} ${input.method}-এর মাধ্যমে ${fmt(input.amount)} BDT উইথড্র অনুরোধ করেছেন। Ref ${shortRef(input.withdrawalId)}.`,
    linkUrl: '/admin/withdrawals',
    priority: 'high',
  });
}

export async function notifyAdminsRewardClaimPending(input: {
  claimId: string;
  itemTitle: string;
  rewardType: string;
  costPaid: number;
  userId: string;
}): Promise<void> {
  const who = await resolvePlayerHandle(input.userId);
  await notifyAdmins({
    kind: 'admin_reward_claim_pending',
    titleEn: `Reward claim: ${input.itemTitle}`,
    titleBn: `রিওয়ার্ড দাবি: ${input.itemTitle}`,
    bodyEn: `${who} claimed "${input.itemTitle}" (${input.rewardType}, ${fmt(input.costPaid)} coins). Ref ${shortRef(input.claimId)}. Review at /admin/reward-claims.`,
    bodyBn: `${who} "${input.itemTitle}" দাবি করেছেন (${input.rewardType}, ${fmt(input.costPaid)} কয়েন)। Ref ${shortRef(input.claimId)}.`,
    linkUrl: '/admin/reward-claims',
    priority: 'normal',
  });
}

export async function notifyAdminsAffiliateApplicationPending(input: {
  applicationId: string;
  userId: string;
  channel?: string | null;
}): Promise<void> {
  const who = await resolvePlayerHandle(input.userId);
  const channel = (input.channel ?? '').trim();
  await notifyAdmins({
    kind: 'admin_affiliate_application_pending',
    titleEn: `Affiliate application from ${who}`,
    titleBn: `${who}-এর অ্যাফিলিয়েট আবেদন`,
    bodyEn: channel
      ? `${who} applied to become an affiliate. Channel: ${channel}. Review at /admin/affiliate.`
      : `${who} applied to become an affiliate. Review at /admin/affiliate.`,
    bodyBn: channel
      ? `${who} অ্যাফিলিয়েট হওয়ার জন্য আবেদন করেছেন। চ্যানেল: ${channel}।`
      : `${who} অ্যাফিলিয়েট হওয়ার জন্য আবেদন করেছেন।`,
    linkUrl: '/admin/affiliate',
    priority: 'normal',
  });
}
