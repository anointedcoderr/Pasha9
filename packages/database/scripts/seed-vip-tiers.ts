// Built by Anointed Coder.
//
// Seeds the default VIP Club tiers (Bronze, Silver, Gold, Platinum, Elite)
// if they do not already exist. Idempotent + non-clobbering: a tier that
// already exists (matched by the unique `name`) is left untouched, so any
// admin edits are never overwritten. New tiers are created active with
// sensible defaults the admin can then tune at /admin/vip.
//
// Run on the VPS from the repo root:
//   pnpm --filter @pasha9/database exec tsx scripts/seed-vip-tiers.ts
//
// Notes for whoever edits the numbers later:
//  - cashbackRatePercent and withdrawalMaxAmount each render as their OWN
//    bullet on the /vip tier ladder, so the perks text below only carries
//    the OTHER benefits (deposit / turnover guidance, payout priority,
//    support). Do not duplicate cashback % or the withdrawal cap in perks.
//  - VIP is application-based: a player applies at /vip and an admin
//    approves them into a tier at /admin/vip > Applications. There is no
//    auto-promotion engine, so the "deposit" and "turnover" lines are
//    guidance copy shown to players, not gates the system enforces.
//  - perks are split on newlines into bullet points, so keep one perk per
//    line.

import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

interface SeedTier {
  name: string;
  nameBn: string;
  position: number;
  description: string;
  descriptionBn: string;
  cashbackRatePercent: string; // Decimal(5,2) as string, e.g. "5.00"
  withdrawalMaxAmount: string; // Decimal(14,2) BDT cap as string
  payoutPriority: number; // higher = paid first
  badgeColor: string; // hex
  perksEn: string; // one perk per line
  perksBn: string;
}

const TIERS: SeedTier[] = [
  {
    name: 'Bronze',
    nameBn: 'ব্রোঞ্জ',
    position: 1,
    description: 'Entry VIP tier. Your first step into the club.',
    descriptionBn: 'প্রবেশ ভিআইপি টিয়ার। ক্লাবে আপনার প্রথম ধাপ।',
    cashbackRatePercent: '3.00',
    withdrawalMaxAmount: '50000',
    payoutPriority: 1,
    badgeColor: '#CD7F32',
    perksEn: [
      'Suggested entry: 10,000৳ total deposits',
      'Turnover to keep status: 1x weekly stake',
      'Standard withdrawal payout priority',
      'Live chat + email support',
    ].join('\n'),
    perksBn: [
      'প্রবেশের পরামর্শ: মোট ১০,০০০৳ ডিপোজিট',
      'স্ট্যাটাস রাখতে টার্নওভার: সাপ্তাহিক ১x বাজি',
      'স্ট্যান্ডার্ড উইথড্র পেআউট অগ্রাধিকার',
      'লাইভ চ্যাট + ইমেইল সাপোর্ট',
    ].join('\n'),
  },
  {
    name: 'Silver',
    nameBn: 'সিলভার',
    position: 2,
    description: 'More cashback, higher limits, priority payouts.',
    descriptionBn: 'বেশি ক্যাশব্যাক, বাড়তি সীমা, অগ্রাধিকার পেআউট।',
    cashbackRatePercent: '5.00',
    withdrawalMaxAmount: '100000',
    payoutPriority: 2,
    badgeColor: '#BFC5CC',
    perksEn: [
      'Suggested entry: 50,000৳ total deposits',
      'Turnover to keep status: 3x weekly stake',
      'Priority withdrawal payouts',
      'Faster live chat support',
    ].join('\n'),
    perksBn: [
      'প্রবেশের পরামর্শ: মোট ৫০,০০০৳ ডিপোজিট',
      'স্ট্যাটাস রাখতে টার্নওভার: সাপ্তাহিক ৩x বাজি',
      'অগ্রাধিকার উইথড্র পেআউট',
      'দ্রুততর লাইভ চ্যাট সাপোর্ট',
    ].join('\n'),
  },
  {
    name: 'Gold',
    nameBn: 'গোল্ড',
    position: 3,
    description: 'Premium tier with a dedicated agent and bonuses.',
    descriptionBn: 'নির্ধারিত এজেন্ট ও বোনাস সহ প্রিমিয়াম টিয়ার।',
    cashbackRatePercent: '7.50',
    withdrawalMaxAmount: '250000',
    payoutPriority: 3,
    badgeColor: '#F5B400',
    perksEn: [
      'Suggested entry: 2,00,000৳ total deposits',
      'Turnover to keep status: 5x weekly stake',
      'High withdrawal payout priority',
      'Dedicated support agent',
      'Birthday + festival bonuses',
    ].join('\n'),
    perksBn: [
      'প্রবেশের পরামর্শ: মোট ২,০০,০০০৳ ডিপোজিট',
      'স্ট্যাটাস রাখতে টার্নওভার: সাপ্তাহিক ৫x বাজি',
      'উচ্চ উইথড্র পেআউট অগ্রাধিকার',
      'নির্ধারিত সাপোর্ট এজেন্ট',
      'জন্মদিন + উৎসব বোনাস',
    ].join('\n'),
  },
  {
    name: 'Platinum',
    nameBn: 'প্ল্যাটিনাম',
    position: 4,
    description: 'Top-priority payouts and a 24/7 VIP manager.',
    descriptionBn: 'সর্বোচ্চ অগ্রাধিকার পেআউট ও ২৪/৭ ভিআইপি ম্যানেজার।',
    cashbackRatePercent: '10.00',
    withdrawalMaxAmount: '500000',
    payoutPriority: 4,
    badgeColor: '#8E9AAF',
    perksEn: [
      'Suggested entry: 5,00,000৳ total deposits',
      'Turnover to keep status: 8x weekly stake',
      'Top withdrawal payout priority',
      '24/7 dedicated VIP manager',
      'Exclusive reload + cashback boosts',
    ].join('\n'),
    perksBn: [
      'প্রবেশের পরামর্শ: মোট ৫,০০,০০০৳ ডিপোজিট',
      'স্ট্যাটাস রাখতে টার্নওভার: সাপ্তাহিক ৮x বাজি',
      'সর্বোচ্চ উইথড্র পেআউট অগ্রাধিকার',
      '২৪/৭ নির্ধারিত ভিআইপি ম্যানেজার',
      'এক্সক্লুসিভ রিলোড + ক্যাশব্যাক বুস্ট',
    ].join('\n'),
  },
  {
    name: 'Elite',
    nameBn: 'এলিট',
    position: 5,
    description: 'Invite-only top tier with bespoke rewards.',
    descriptionBn: 'শুধুমাত্র আমন্ত্রণে শীর্ষ টিয়ার, কাস্টম রিওয়ার্ড সহ।',
    cashbackRatePercent: '12.50',
    withdrawalMaxAmount: '1000000',
    payoutPriority: 5,
    badgeColor: '#B07CF5',
    perksEn: [
      'Invite-only top tier',
      'Suggested entry: 20,00,000৳ total deposits',
      'Turnover to keep status: 10x weekly stake',
      'Fastest payouts, highest limits',
      'Personal account manager + custom offers',
      'VIP events and bespoke rewards',
    ].join('\n'),
    perksBn: [
      'শুধুমাত্র আমন্ত্রণে শীর্ষ টিয়ার',
      'প্রবেশের পরামর্শ: মোট ২০,০০,০০০৳ ডিপোজিট',
      'স্ট্যাটাস রাখতে টার্নওভার: সাপ্তাহিক ১০x বাজি',
      'দ্রুততম পেআউট, সর্বোচ্চ সীমা',
      'ব্যক্তিগত অ্যাকাউন্ট ম্যানেজার + কাস্টম অফার',
      'ভিআইপি ইভেন্ট ও বিশেষ রিওয়ার্ড',
    ].join('\n'),
  },
];

async function main() {
  let created = 0;
  let skipped = 0;
  for (const t of TIERS) {
    const existing = await db.vipTier.findUnique({ where: { name: t.name } });
    if (existing) {
      console.log(`skip   ${t.name} (already exists, left untouched)`);
      skipped += 1;
      continue;
    }
    await db.vipTier.create({
      data: {
        name: t.name,
        nameBn: t.nameBn,
        position: t.position,
        description: t.description,
        descriptionBn: t.descriptionBn,
        cashbackRatePercent: t.cashbackRatePercent,
        withdrawalMaxAmount: t.withdrawalMaxAmount,
        payoutPriority: t.payoutPriority,
        badgeColor: t.badgeColor,
        perksEn: t.perksEn,
        perksBn: t.perksBn,
        status: 'active',
      },
    });
    console.log(`create ${t.name}`);
    created += 1;
  }
  const active = await db.vipTier.count({ where: { status: 'active' } });
  console.log(`\nDone. created=${created} skipped=${skipped} | active VIP tiers now: ${active}`);
}

main()
  .catch((e) => {
    console.error('[seed-vip-tiers] failed:', e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
