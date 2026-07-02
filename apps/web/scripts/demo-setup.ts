// Built by Anointed Coder.
//
// Production demo setup for Pasha9. One idempotent script the operator
// runs on the VPS to configure demo campaigns, bonus rules and banners
// so deposits can be tested end to end.
//
// Run from apps/web:
//   pnpm --filter @pasha9/web exec tsx scripts/demo-setup.ts
//
// Required env:
//   DATABASE_URL   Postgres connection string (same one the app uses)
//   UPLOAD_ROOT    optional, where banner webp files are written
//                  (defaults to ./uploads, the dev convention; on the
//                  VPS this is /var/www/pasha9/uploads)
//
// Guarantees:
//   - Idempotent. Every row is upserted by a stable code / name / key,
//     so running the script twice never duplicates anything.
//   - Never writes to money tables. Only BonusRule, DepositBonusTier,
//     CashbackCampaign, Banner, PromotionBanner, BettingPassBanner,
//     BettingPassRule, CommissionTier, LottoDraw and SystemSetting.
//   - Banner images are regenerated with deterministic filenames, so a
//     re-run overwrites the same files instead of accumulating copies.

import { PrismaClient, Prisma } from '@prisma/client';
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const db = new PrismaClient();

// ---------------------------------------------------------------------
// Summary bookkeeping: created vs already present (refreshed in place).
// ---------------------------------------------------------------------

const createdItems: string[] = [];
const presentItems: string[] = [];
const fileItems: string[] = [];
const deactivatedItems: string[] = [];

function note(label: string, existed: boolean) {
  (existed ? presentItems : createdItems).push(label);
}

// ---------------------------------------------------------------------
// Banner artwork. Dark base #0F1115 with gold #FFCC00 accents, rounded
// shapes, a big Bangla headline and a small English subline, plus the
// Pasha9 wordmark. Rendered from an SVG string to webp via sharp.
// ---------------------------------------------------------------------

const INK = '#0F1115';
const GOLD = '#FFCC00';

interface BannerArt {
  file: string;
  width: number;
  height: number;
  headlineBn: string;
  subEn: string;
  tag: string;
}

function bannerSvg(a: BannerArt): string {
  const { width: w, height: h } = a;
  // Cap the Bangla headline so long copy never collides with the gold
  // disc on the right: shrink the font size when the estimated natural
  // width exceeds the safe text column.
  const maxHeadWidth = w * 0.64;
  const baseHead = h * 0.135;
  const headSize = Math.round(Math.min(baseHead, maxHeadWidth / (Math.max(1, a.headlineBn.length) * 0.58)));
  const maxSubWidth = w * 0.66;
  const baseSub = h * 0.07;
  const subSize = Math.round(Math.min(baseSub, maxSubWidth / (Math.max(1, a.subEn.length) * 0.52)));
  const tagSize = Math.round(h * 0.06);
  const pad = Math.round(w * 0.055);
  const ringCx = w * 0.88;
  const ringCy = h * 0.5;
  const ringR = h * 0.62;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${INK}"/>
      <stop offset="0.62" stop-color="#141926"/>
      <stop offset="1" stop-color="#1B1405"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FFE066"/>
      <stop offset="0.5" stop-color="${GOLD}"/>
      <stop offset="1" stop-color="#D9A400"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${GOLD}" stop-opacity="0.35"/>
      <stop offset="1" stop-color="${GOLD}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" rx="${Math.round(h * 0.05)}" fill="url(#bg)"/>
  <circle cx="${ringCx}" cy="${ringCy}" r="${ringR}" fill="url(#glow)"/>
  <circle cx="${ringCx}" cy="${ringCy}" r="${h * 0.42}" fill="none" stroke="url(#gold)" stroke-width="${Math.max(3, h * 0.012)}" opacity="0.85"/>
  <circle cx="${ringCx}" cy="${ringCy}" r="${h * 0.30}" fill="none" stroke="${GOLD}" stroke-width="${Math.max(2, h * 0.006)}" opacity="0.35"/>
  <circle cx="${ringCx}" cy="${ringCy}" r="${h * 0.16}" fill="url(#gold)" opacity="0.92"/>
  <text x="${ringCx}" y="${ringCy + h * 0.055}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.round(h * 0.15)}" font-weight="800" fill="${INK}">P9</text>
  <rect x="${w * 0.58}" y="${h * 0.78}" width="${w * 0.11}" height="${h * 0.05}" rx="${h * 0.025}" fill="${GOLD}" opacity="0.5"/>
  <rect x="${w * 0.70}" y="${h * 0.86}" width="${w * 0.07}" height="${h * 0.035}" rx="${h * 0.0175}" fill="${GOLD}" opacity="0.25"/>
  <rect x="${pad}" y="${h * 0.12}" width="${Math.round(w * 0.135)}" height="${Math.round(h * 0.105)}" rx="${Math.round(h * 0.05)}" fill="none" stroke="url(#gold)" stroke-width="2"/>
  <text x="${pad + Math.round(w * 0.0675)}" y="${h * 0.195}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.round(h * 0.052)}" font-weight="800" letter-spacing="2" fill="${GOLD}">PASHA9</text>
  <text x="${pad}" y="${h * 0.36}" font-family="Arial, sans-serif" font-size="${tagSize}" font-weight="600" letter-spacing="3" fill="#8A93A6">${a.tag.toUpperCase()}</text>
  <text x="${pad}" y="${h * 0.56}" font-family="'Noto Sans Bengali', 'Nirmala UI', 'Hind Siliguri', sans-serif" font-size="${headSize}" font-weight="800" fill="url(#gold)">${a.headlineBn}</text>
  <text x="${pad}" y="${h * 0.70}" font-family="Arial, sans-serif" font-size="${subSize}" font-weight="500" fill="#C8CFDC">${a.subEn}</text>
  <rect x="${pad}" y="${h * 0.78}" width="${w * 0.16}" height="${h * 0.10}" rx="${h * 0.05}" fill="url(#gold)"/>
  <text x="${pad + w * 0.08}" y="${h * 0.845}" text-anchor="middle" font-family="Arial, sans-serif" font-size="${Math.round(h * 0.045)}" font-weight="700" fill="${INK}">DEPOSIT NOW</text>
</svg>`;
}

const UPLOAD_ROOT = process.env.UPLOAD_ROOT ?? './uploads';
const BANNER_DIR = join(UPLOAD_ROOT, 'banners');

async function renderBanner(a: BannerArt): Promise<string> {
  const path = join(BANNER_DIR, a.file);
  await sharp(Buffer.from(bannerSvg(a))).webp({ quality: 88 }).toFile(path);
  fileItems.push(path);
  return `/uploads/banners/${a.file}`;
}

// ---------------------------------------------------------------------
// Generic upsert helpers with created / present reporting.
// ---------------------------------------------------------------------

async function upsertBonusRuleByCode(code: string, data: Prisma.BonusRuleUncheckedCreateInput): Promise<void> {
  const existing = await db.bonusRule.findUnique({ where: { code }, select: { id: true } });
  if (existing) {
    await db.bonusRule.update({ where: { code }, data });
  } else {
    await db.bonusRule.create({ data: { ...data, code } });
  }
  note(`BonusRule ${code} (${data.name})`, Boolean(existing));
}

async function ensureSetting(key: string, value: string, type: string, category:
  'general' | 'payment' | 'referral' | 'rewards' | 'content'): Promise<void> {
  const existing = await db.systemSetting.findUnique({ where: { key }, select: { id: true } });
  if (!existing) {
    await db.systemSetting.create({ data: { key, value, type, category } });
  }
  note(`SystemSetting ${key}`, Boolean(existing));
}

// ---------------------------------------------------------------------
// 1. Welcome Bonus: 100% on the first approved deposit.
// ---------------------------------------------------------------------

async function setupWelcomeBonus(bannerUrl: string): Promise<void> {
  await upsertBonusRuleByCode('welcome', {
    name: 'Welcome Bonus',
    nameBn: 'ওয়েলকাম বোনাস',
    type: 'first_deposit',
    promotionType: 'first_deposit_bonus',
    percentage: 100,
    amount: 0,
    minDeposit: 500,
    maxBonus: 5000,
    turnoverX: 10,
    validityDays: 30,
    priority: 100,
    // Belt and braces: the engine already blocks a second first_deposit
    // grant, the account claim window makes the same intent explicit.
    claimPeriod: 'account',
    claimLimit: 1,
    status: 'active',
    description: '100% bonus on your first deposit of 500 BDT or more, up to 5,000 BDT. Wager 10x the bonus to unlock withdrawal.',
    descriptionBn: 'আপনার প্রথম ডিপোজিটে ১০০% বোনাস। সর্বনিম্ন ডিপোজিট ৫০০ টাকা, সর্বোচ্চ বোনাস ৫,০০০ টাকা। উত্তোলনের আগে বোনাসের ১০ গুণ টার্নওভার করতে হবে।',
    bannerUrl,
    bannerDesktopUrl: bannerUrl,
    termsEn: 'First approved deposit only. Minimum deposit 500 BDT. Bonus is 100% of the deposit, capped at 5,000 BDT. Wagering requirement is 10x the bonus amount before withdrawal.',
    termsBn: 'শুধুমাত্র প্রথম অনুমোদিত ডিপোজিটে প্রযোজ্য। সর্বনিম্ন ডিপোজিট ৫০০ টাকা। বোনাস ডিপোজিটের ১০০%, সর্বোচ্চ ৫,০০০ টাকা। উত্তোলনের আগে বোনাসের ১০ গুণ ওয়েজার করতে হবে।',
    meta: {
      promotion: {
        claimBehavior: 'deposit',
        depositRequired: true,
        requiredDepositAmount: 500,
      },
    },
  });
}

// ---------------------------------------------------------------------
// 2. Deposit tier ladder: reload % on every deposit, plus the managed
//    BonusRule mirror per tier. The mirror replicates
//    lib/bonuses/deposit-tiers.ts syncTierToBonusRule exactly:
//    code deposit_tier_<id>, type reload, maxBonus 0 (tiers are
//    percentage only, no per-tier cap), meta.managedBy =
//    deposit_bonus_tier, priority = max(100, minDeposit / 100).
// ---------------------------------------------------------------------

interface TierSpec {
  minDeposit: number;
  percentage: number;
  position: number;
  titleEn: string;
  titleBn: string;
  descriptionEn: string;
  descriptionBn: string;
}

const TIER_SPECS: TierSpec[] = [
  {
    minDeposit: 500, percentage: 5, position: 1,
    titleEn: 'Reload Bonus 5%',
    titleBn: 'রিলোড বোনাস ৫%',
    descriptionEn: '5% bonus on every deposit of 500 BDT or more. Wager 10x the bonus before withdrawal.',
    descriptionBn: '৫০০ টাকা বা তার বেশি প্রতিটি ডিপোজিটে ৫% বোনাস। উত্তোলনের আগে বোনাসের ১০ গুণ টার্নওভার প্রযোজ্য।',
  },
  {
    minDeposit: 2000, percentage: 8, position: 2,
    titleEn: 'Reload Bonus 8%',
    titleBn: 'রিলোড বোনাস ৮%',
    descriptionEn: '8% bonus on every deposit of 2,000 BDT or more. Wager 10x the bonus before withdrawal.',
    descriptionBn: '২,০০০ টাকা বা তার বেশি প্রতিটি ডিপোজিটে ৮% বোনাস। উত্তোলনের আগে বোনাসের ১০ গুণ টার্নওভার প্রযোজ্য।',
  },
  {
    minDeposit: 10000, percentage: 12, position: 3,
    titleEn: 'Reload Bonus 12%',
    titleBn: 'রিলোড বোনাস ১২%',
    descriptionEn: '12% bonus on every deposit of 10,000 BDT or more. Wager 10x the bonus before withdrawal.',
    descriptionBn: '১০,০০০ টাকা বা তার বেশি প্রতিটি ডিপোজিটে ১২% বোনাস। উত্তোলনের আগে বোনাসের ১০ গুণ টার্নওভার প্রযোজ্য।',
  },
];

// Exact replica of syncTierToBonusRule from lib/bonuses/deposit-tiers.ts
// (cannot import app code through the @/ alias from a tsx script). It
// deliberately writes neither maxBonus nor nameBn beyond what the lib
// writes, so a later tier edit in the admin (which re-runs the lib
// sync) produces exactly the same rule and nothing goes stale.
async function syncTierToManagedRule(tier: {
  id: string;
  minDeposit: Prisma.Decimal | number;
  percentage: number;
  isActive: boolean;
  turnoverX: Prisma.Decimal | number | null;
  claimPeriod: string | null;
  claimLimit: number | null;
  titleEn: string | null;
  descriptionEn: string | null;
  descriptionBn: string | null;
  bannerUrl: string | null;
}): Promise<void> {
  const code = `deposit_tier_${tier.id}`;
  const minDepositNumber = Number(tier.minDeposit);
  const priority = Math.max(100, Math.floor(minDepositNumber / 100));
  const name = tier.titleEn?.trim() || `Deposit tier ${tier.percentage}% (>= ${minDepositNumber.toLocaleString()} BDT)`;
  const rawTurnover = tier.turnoverX == null ? 0 : Number(tier.turnoverX);
  const safeTurnover = Number.isFinite(rawTurnover) && rawTurnover > 0 ? rawTurnover : 0;
  const claimPeriod = tier.claimPeriod ?? 'unlimited';
  const rawClaimLimit = Number(tier.claimLimit ?? 0);
  const claimLimit = Number.isFinite(rawClaimLimit) && rawClaimLimit > 0 ? Math.floor(rawClaimLimit) : 0;

  const data = {
    name,
    type: 'reload' as const,
    percentage: new Prisma.Decimal(tier.percentage),
    amount: new Prisma.Decimal(0),
    minDeposit: new Prisma.Decimal(minDepositNumber),
    maxBonus: new Prisma.Decimal(0),
    status: (tier.isActive ? 'active' : 'hidden') as 'active' | 'hidden',
    description: tier.descriptionEn?.trim() || null,
    descriptionBn: tier.descriptionBn?.trim() || null,
    bannerUrl: tier.bannerUrl?.trim() || null,
    turnoverX: new Prisma.Decimal(safeTurnover),
    validityDays: 30,
    priority,
    claimPeriod,
    claimLimit,
    meta: { managedBy: 'deposit_bonus_tier', tierId: tier.id } as Prisma.JsonObject,
  };

  const existing = await db.bonusRule.findUnique({ where: { code }, select: { id: true } });
  await db.bonusRule.upsert({
    where: { code },
    update: data,
    create: { ...data, code },
  });
  note(`BonusRule ${code} (${name})`, Boolean(existing));
}

async function setupDepositTiers(): Promise<void> {
  for (const spec of TIER_SPECS) {
    // DepositBonusTier has no natural unique key, so minDeposit is the
    // stable identity for the demo ladder.
    const existing = await db.depositBonusTier.findFirst({ where: { minDeposit: spec.minDeposit } });
    if (existing && !existing.isActive) {
      // The operator archived this tier on purpose (delete on a tier
      // with grant history deactivates it). Do not resurrect it.
      console.log(`[demo-setup] tier at ${spec.minDeposit}+ BDT exists but is deactivated (operator archived it), skipping, re-enable in admin if wanted`);
      note(`DepositBonusTier ${spec.percentage}% at ${spec.minDeposit}+ BDT (left deactivated, skipped)`, true);
      continue;
    }
    const data = {
      minDeposit: spec.minDeposit,
      percentage: spec.percentage,
      isActive: true,
      position: spec.position,
      turnoverX: 10,
      claimPeriod: 'unlimited',
      claimLimit: 0,
      titleEn: spec.titleEn,
      titleBn: spec.titleBn,
      descriptionEn: spec.descriptionEn,
      descriptionBn: spec.descriptionBn,
    };
    const row = existing
      ? await db.depositBonusTier.update({ where: { id: existing.id }, data })
      : await db.depositBonusTier.create({ data });
    note(`DepositBonusTier ${spec.percentage}% at ${spec.minDeposit}+ BDT`, Boolean(existing));
    await syncTierToManagedRule(row);
  }

  // Reconcile: any ACTIVE tier outside the spec ladder would compete
  // with it (the engine picks the highest matching minDeposit), so
  // deactivate it and hide its managed rule. Nothing is deleted; the
  // operator can re-enable any of these from the admin at any time.
  const specMinDeposits = TIER_SPECS.map((s) => s.minDeposit);
  const strays = await db.depositBonusTier.findMany({
    where: { isActive: true, minDeposit: { notIn: specMinDeposits } },
    orderBy: { minDeposit: 'asc' },
  });
  for (const stray of strays) {
    await db.depositBonusTier.update({ where: { id: stray.id }, data: { isActive: false } });
    await db.bonusRule.updateMany({
      where: { code: `deposit_tier_${stray.id}` },
      data: { status: 'hidden' },
    });
    const label = `non-spec tier at ${Number(stray.minDeposit).toLocaleString()}+ BDT (was ${stray.percentage} percent)`;
    console.log(`[demo-setup] deactivated ${label}, re-enable in admin if wanted`);
    deactivatedItems.push(label);
  }
}

// ---------------------------------------------------------------------
// 3. Daily Bonus: 5% on the first qualifying deposit of each day.
//    Priority 50 sits below the tier ladder (priority 100), and the
//    engine grants at most one reload rule per deposit, so in practice
//    this covers the 200 to 499 BDT band where no tier matches.
// ---------------------------------------------------------------------

async function setupDailyBonus(bannerUrl: string): Promise<void> {
  await upsertBonusRuleByCode('daily_bonus', {
    name: 'Daily Bonus',
    nameBn: 'ডেইলি বোনাস',
    type: 'reload',
    percentage: 5,
    amount: 0,
    minDeposit: 200,
    maxBonus: 500,
    turnoverX: 10,
    validityDays: 30,
    priority: 50,
    claimPeriod: 'day',
    claimLimit: 1,
    status: 'active',
    description: '5% bonus on your first deposit of each day (from 200 BDT), up to 500 BDT. Deposits of 500 BDT or more receive the bigger reload tier instead.',
    descriptionBn: 'প্রতিদিনের প্রথম ডিপোজিটে ৫% বোনাস (সর্বনিম্ন ২০০ টাকা), সর্বোচ্চ ৫০০ টাকা। ৫০০ টাকা বা তার বেশি ডিপোজিটে বড় রিলোড টিয়ার প্রযোজ্য হবে।',
    bannerUrl,
    bannerDesktopUrl: bannerUrl,
    termsEn: 'Once per day, first qualifying deposit only. Minimum deposit 200 BDT, bonus capped at 500 BDT. Wagering requirement is 10x the bonus amount.',
    termsBn: 'দিনে একবার, শুধুমাত্র প্রথম যোগ্য ডিপোজিটে। সর্বনিম্ন ডিপোজিট ২০০ টাকা, সর্বোচ্চ বোনাস ৫০০ টাকা। বোনাসের ১০ গুণ ওয়েজার প্রয়োজন।',
    meta: {
      promotion: {
        claimBehavior: 'deposit',
        depositRequired: true,
        requiredDepositAmount: 200,
      },
    },
  });
}

// ---------------------------------------------------------------------
// 4. Daily Cashback: 10% of net loss, paid nightly by the cashback
//    cron. Existing operator campaigns are never touched.
// ---------------------------------------------------------------------

async function setupDailyCashback(): Promise<void> {
  const nameEn = 'Daily Cashback';
  const existing = await db.cashbackCampaign.findFirst({ where: { nameEn } });
  const data = {
    nameEn,
    nameBn: 'ডেইলি ক্যাশব্যাক',
    source: 'net_loss',
    percentage: 10,
    maxCashback: 500,
    turnoverX: 10,
    cadence: 'daily',
    scopeType: 'all',
    scopeKeys: [] as string[],
    isActive: true,
  };
  if (existing) {
    await db.cashbackCampaign.update({ where: { id: existing.id }, data });
  } else {
    await db.cashbackCampaign.create({ data });
  }
  note('CashbackCampaign Daily Cashback 10%', Boolean(existing));
}

// ---------------------------------------------------------------------
// 5. Betting Pass: runtime config + tier ladder. Rules are created only
//    when the tier number is missing so operator tuning survives.
// ---------------------------------------------------------------------

async function setupBettingPass(bannerUrl: string): Promise<void> {
  const configKey = 'betting_pass_config_v1';
  const existingConfig = await db.systemSetting.findUnique({ where: { key: configKey }, select: { id: true } });
  if (!existingConfig) {
    await db.systemSetting.create({
      data: {
        key: configKey,
        value: JSON.stringify({ enabled: true, pointsPerBdtDeposit: 1, pointsPerBdtBet: 1, seasonKey: 'season_1' }),
        type: 'json',
        category: 'rewards',
      },
    });
  }
  note(`SystemSetting ${configKey}`, Boolean(existingConfig));

  const tiers = [
    { tier: 1, nameEn: 'Bronze Pass', nameBn: 'ব্রোঞ্জ পাস', pointsRequired: 1000, rewardKind: 'bonus', rewardAmount: 200, turnoverX: 10, descriptionEn: 'Reach 1,000 points to claim a 200 BDT bonus.', descriptionBn: '১,০০০ পয়েন্টে ২০০ টাকা বোনাস।' },
    { tier: 2, nameEn: 'Silver Pass', nameBn: 'সিলভার পাস', pointsRequired: 5000, rewardKind: 'bonus', rewardAmount: 500, turnoverX: 10, descriptionEn: 'Reach 5,000 points to claim a 500 BDT bonus.', descriptionBn: '৫,০০০ পয়েন্টে ৫০০ টাকা বোনাস।' },
    { tier: 3, nameEn: 'Gold Pass', nameBn: 'গোল্ড পাস', pointsRequired: 15000, rewardKind: 'bonus', rewardAmount: 1500, turnoverX: 10, descriptionEn: 'Reach 15,000 points to claim a 1,500 BDT bonus.', descriptionBn: '১৫,০০০ পয়েন্টে ১,৫০০ টাকা বোনাস।' },
    { tier: 4, nameEn: 'Diamond Pass', nameBn: 'ডায়মন্ড পাস', pointsRequired: 50000, rewardKind: 'bonus', rewardAmount: 5000, turnoverX: 10, descriptionEn: 'Reach 50,000 points to claim a 5,000 BDT bonus.', descriptionBn: '৫০,০০০ পয়েন্টে ৫,০০০ টাকা বোনাস।' },
  ];
  for (const t of tiers) {
    const existing = await db.bettingPassRule.findUnique({ where: { tier: t.tier }, select: { id: true } });
    if (!existing) {
      await db.bettingPassRule.create({ data: { ...t, isActive: true } });
    }
    note(`BettingPassRule tier ${t.tier} (${t.nameEn})`, Boolean(existing));
  }

  const titleEn = 'Betting Pass Season 1';
  const existingBanner = await db.bettingPassBanner.findFirst({ where: { titleEn } });
  const bannerData = {
    titleEn,
    titleBn: 'বেটিং পাস সিজন ১',
    subtitleEn: 'Earn points on every deposit and bet',
    subtitleBn: 'প্রতিটি ডিপোজিট ও বেটে পয়েন্ট জিতুন',
    imageUrl: bannerUrl,
    sortOrder: 10,
    isActive: true,
  };
  if (existingBanner) {
    await db.bettingPassBanner.update({ where: { id: existingBanner.id }, data: bannerData });
  } else {
    await db.bettingPassBanner.create({ data: bannerData });
  }
  note('BettingPassBanner Betting Pass Season 1', Boolean(existingBanner));
}

// ---------------------------------------------------------------------
// 6. Referral: verify the seeded commission tiers, create only what is
//    missing. Settings are created only when absent so operator edits
//    survive.
// ---------------------------------------------------------------------

async function setupReferral(): Promise<void> {
  const tiers = [
    { name: 'bronze', description: 'Entry tier for new affiliates. Earn 8 / 4 / 2 percent across three downline levels.', level1Pct: 8.0, level2Pct: 4.0, level3Pct: 2.0, minActiveReferrals: 0, minMonthlyVolume: 0, position: 1 },
    { name: 'silver', description: 'Mid tier unlocked once 10 referrals are active and monthly volume hits 50,000 BDT.', level1Pct: 10.0, level2Pct: 5.0, level3Pct: 2.0, minActiveReferrals: 10, minMonthlyVolume: 50000, position: 2 },
    { name: 'gold', description: 'Top tier for high-performing affiliates with 30+ active referrals and 200,000+ BDT monthly volume.', level1Pct: 12.0, level2Pct: 6.0, level3Pct: 3.0, minActiveReferrals: 30, minMonthlyVolume: 200000, position: 3 },
  ];
  for (const t of tiers) {
    const existing = await db.commissionTier.findUnique({ where: { name: t.name }, select: { id: true } });
    if (!existing) {
      await db.commissionTier.create({ data: t });
    }
    note(`CommissionTier ${t.name}`, Boolean(existing));
  }

  // Commission percentages live on the CommissionTier rows above;
  // no engine code reads per-level referral settings, so none are
  // written here.
  await ensureSetting('referral_first_deposit_min_bdt', '300', 'number', 'referral');
}

// ---------------------------------------------------------------------
// 7. Lotto: guarantee at least one open draw with a future draw time.
// ---------------------------------------------------------------------

function nextEveningDraw(): Date {
  // Tomorrow at 15:00 UTC, which is 21:00 in Dhaka (UTC+6).
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(15, 0, 0, 0);
  return d;
}

async function setupLotto(): Promise<void> {
  await ensureSetting('lotto_enabled', 'true', 'boolean', 'general');

  const openFuture = await db.lottoDraw.findFirst({
    where: { status: 'active', settledAt: null, closedAt: null, drawsAt: { gt: new Date() } },
    select: { id: true, name: true },
  });
  if (openFuture) {
    note(`LottoDraw open future draw (${openFuture.name})`, true);
    return;
  }
  // Prefer stamping a draw time on an existing open draw over creating
  // a duplicate row. The seed leaves drawsAt null on its sample draws.
  const openNoTime = await db.lottoDraw.findFirst({
    where: { status: 'active', settledAt: null, closedAt: null, drawsAt: null },
    orderBy: { position: 'asc' },
    select: { id: true, name: true },
  });
  if (openNoTime) {
    await db.lottoDraw.update({ where: { id: openNoTime.id }, data: { drawsAt: nextEveningDraw() } });
    note(`LottoDraw ${openNoTime.name} (draw time stamped)`, true);
    return;
  }
  await db.lottoDraw.create({
    data: {
      name: 'Daily 4D',
      schedule: 'Daily 21:00',
      drawsAt: nextEveningDraw(),
      digitsCount: 4,
      ticketPrice: 20,
      prizePool: 1500000,
      accent: 'yellow',
      position: 1,
      status: 'active',
    },
  });
  note('LottoDraw Daily 4D', false);
}

// ---------------------------------------------------------------------
// 8. Homepage hero banners (positions 1 and 2) + promotions hero deck.
// ---------------------------------------------------------------------

// Rows whose imageUrl carries this marker were written by this script.
// Everything else on the banners table belongs to the operator and is
// never modified, and video slides are never touched under any
// circumstances.
const SCRIPT_BANNER_MARKER = '/uploads/banners/pasha9-';

async function upsertHeroBanner(
  desiredPosition: number,
  data: {
    title: string; titleEn: string; subtitle: string; subtitleEn: string;
    imageUrl: string; link: string; ctaLabel: string;
  },
  managedImageUrls: string[],
): Promise<void> {
  const content = {
    ...data,
    mediaType: 'image',
    accent: 'gold',
    status: 'active' as const,
  };

  // 1. A row already carrying this exact generated file is ours:
  //    refresh its copy in place and keep whatever position the
  //    operator gave it (they may have re-ordered the slider).
  const owned = await db.banner.findFirst({
    where: { imageUrl: data.imageUrl, mediaType: { not: 'video' } },
    select: { id: true, position: true },
  });
  if (owned) {
    await db.banner.update({ where: { id: owned.id }, data: { ...content, position: owned.position } });
    note(`Banner hero position ${owned.position} (${data.titleEn})`, true);
    return;
  }

  const occupant = await db.banner.findFirst({
    where: { position: desiredPosition },
    select: { id: true, imageUrl: true, mediaType: true },
  });

  // 2. Desired position is free: take it.
  if (!occupant) {
    await db.banner.create({ data: { ...content, position: desiredPosition } });
    note(`Banner hero position ${desiredPosition} (${data.titleEn})`, false);
    return;
  }

  // 3. Desired position holds a stale row this script wrote earlier
  //    (script marker, image slide, and not one of the files managed
  //    in this run): repurpose it instead of leaving a leftover.
  const occupantIsStaleScriptRow =
    occupant.mediaType !== 'video' &&
    Boolean(occupant.imageUrl?.startsWith(SCRIPT_BANNER_MARKER)) &&
    !managedImageUrls.includes(occupant.imageUrl ?? '');
  if (occupantIsStaleScriptRow) {
    await db.banner.update({ where: { id: occupant.id }, data: { ...content, position: desiredPosition } });
    note(`Banner hero position ${desiredPosition} (${data.titleEn})`, true);
    return;
  }

  // 4. Desired position holds operator content (their own artwork or
  //    a video slide). Leave it untouched and create the demo banner
  //    at the next free position instead.
  const taken = new Set((await db.banner.findMany({ select: { position: true } })).map((b) => b.position));
  let freePosition = desiredPosition + 1;
  while (taken.has(freePosition)) freePosition += 1;
  await db.banner.create({ data: { ...content, position: freePosition } });
  console.log(`[demo-setup] hero position ${desiredPosition} holds operator content, created "${data.titleEn}" at free position ${freePosition} instead`);
  note(`Banner hero position ${freePosition} (${data.titleEn}, position ${desiredPosition} was operator-owned)`, false);
}

async function setupBanners(images: Record<string, string>): Promise<void> {
  const managedImageUrls = [images.heroWelcome, images.heroCashback];
  await upsertHeroBanner(1, {
    title: 'প্রথম ডিপোজিটে ১০০% বোনাস',
    titleEn: 'First Deposit 100% Bonus',
    subtitle: 'সর্বোচ্চ ৫,০০০ টাকা, মাত্র ৫০০ টাকা থেকে শুরু',
    subtitleEn: 'Up to 5,000 BDT, start from just 500 BDT',
    imageUrl: images.heroWelcome,
    link: '/promotions',
    ctaLabel: 'ডিপোজিট করুন',
  }, managedImageUrls);
  await upsertHeroBanner(2, {
    title: 'প্রতিদিন ১০% ক্যাশব্যাক',
    titleEn: 'Daily 10% Cashback',
    subtitle: 'নেট লসের উপর প্রতিদিন ক্যাশব্যাক, সর্বোচ্চ ৫০০ টাকা',
    subtitleEn: 'Daily cashback on net loss, up to 500 BDT',
    imageUrl: images.heroCashback,
    link: '/promotions',
    ctaLabel: 'বিস্তারিত দেখুন',
  }, managedImageUrls);

  const titleEn = 'Pasha9 Premium Promotions';
  const existing = await db.promotionBanner.findFirst({ where: { titleEn } });
  const data = {
    titleEn,
    titleBn: 'পাশা৯ প্রিমিয়াম প্রমোশন',
    subtitleEn: 'Fresh offers every day',
    subtitleBn: 'প্রতিদিন নতুন অফার',
    imageUrl: images.promoHero,
    sortOrder: 10,
    isActive: true,
  };
  if (existing) {
    await db.promotionBanner.update({ where: { id: existing.id }, data });
  } else {
    await db.promotionBanner.create({ data });
  }
  note('PromotionBanner Pasha9 Premium Promotions', Boolean(existing));
}

// ---------------------------------------------------------------------
// Main.
// ---------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('[demo-setup] starting');
  console.log(`[demo-setup] banner output dir: ${BANNER_DIR}`);
  // Preflight: banner headlines are rendered with the Noto Sans Bengali
  // font. If the host has no Bengali font installed the Bangla text in
  // the generated images comes out as empty boxes. On the VPS install
  // it first, then re-run this script:
  //   sudo apt-get install -y fonts-noto-bengali && fc-cache -f
  console.log('[demo-setup] preflight: banner text uses the Noto Sans Bengali font.');
  console.log('[demo-setup] preflight: if this host has no Bengali font, the Bangla headlines render as boxes.');
  console.log('[demo-setup] preflight: install hint: sudo apt-get install -y fonts-noto-bengali && fc-cache -f');
  await mkdir(BANNER_DIR, { recursive: true });

  // Render all artwork first (deterministic filenames, re-run overwrites).
  const heroWelcome = await renderBanner({
    file: 'pasha9-hero-welcome.webp', width: 1200, height: 480,
    headlineBn: 'প্রথম ডিপোজিটে ১০০% বোনাস',
    subEn: 'Welcome bonus up to 5,000 BDT, start from 500 BDT',
    tag: 'Welcome Offer',
  });
  const heroCashback = await renderBanner({
    file: 'pasha9-hero-cashback.webp', width: 1200, height: 480,
    headlineBn: 'প্রতিদিন ১০% ক্যাশব্যাক',
    subEn: 'Daily cashback on net loss, up to 500 BDT',
    tag: 'Daily Cashback',
  });
  const promoWelcome = await renderBanner({
    file: 'pasha9-promo-welcome.webp', width: 900, height: 360,
    headlineBn: '১০০% ওয়েলকাম বোনাস',
    subEn: 'First deposit from 500 BDT, up to 5,000 BDT',
    tag: 'First Deposit',
  });
  const promoDaily = await renderBanner({
    file: 'pasha9-promo-daily.webp', width: 900, height: 360,
    headlineBn: 'প্রতিদিন ৫% ডেইলি বোনাস',
    subEn: 'First deposit of every day, from 200 BDT',
    tag: 'Daily Bonus',
  });
  const promoHero = await renderBanner({
    file: 'pasha9-promo-hero.webp', width: 1200, height: 480,
    headlineBn: 'পাশা৯ প্রমোশন',
    subEn: 'Premium offers, bonuses and cashback every day',
    tag: 'Promotions',
  });
  const bettingPass = await renderBanner({
    file: 'pasha9-betting-pass.webp', width: 900, height: 360,
    headlineBn: 'বেটিং পাস রিওয়ার্ড',
    subEn: 'Earn points on every deposit and bet, claim real rewards',
    tag: 'Betting Pass',
  });

  await setupWelcomeBonus(promoWelcome);
  await setupDepositTiers();
  await setupDailyBonus(promoDaily);
  await setupDailyCashback();
  await setupBettingPass(bettingPass);
  await setupReferral();
  await setupLotto();
  await setupBanners({ heroWelcome, heroCashback, promoHero });

  console.log('');
  console.log('[demo-setup] summary');
  console.log(`  created (${createdItems.length}):`);
  for (const c of createdItems) console.log(`    + ${c}`);
  if (createdItems.length === 0) console.log('    (nothing, everything was already present)');
  console.log(`  already present, refreshed (${presentItems.length}):`);
  for (const p of presentItems) console.log(`    = ${p}`);
  if (deactivatedItems.length > 0) {
    console.log(`  deactivated non-spec tiers (${deactivatedItems.length}), re-enable in admin if wanted:`);
    for (const d of deactivatedItems) console.log(`    - ${d}`);
  }
  console.log(`  banner files written (${fileItems.length}):`);
  for (const f of fileItems) console.log(`    * ${f}`);
  console.log('[demo-setup] done');
}

main()
  .catch((err) => {
    console.error('[demo-setup] failed', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
