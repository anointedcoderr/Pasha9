/**
 * Pasha9 database seed.
 *
 * Idempotent. Safe to run multiple times. Populates system roles, permissions,
 * the initial super admin user, default homepage content, sample categories,
 * providers, sample games, payment methods, and empty system settings buckets
 * so the public site is alive immediately after deploy.
 *
 * Super admin credentials are taken from environment variables. Never hard-coded:
 *   SEED_SUPERADMIN_USERNAME   (default: pasha9.admin)
 *   SEED_SUPERADMIN_PHONE      (default: 01700000001)
 *   SEED_SUPERADMIN_PASSWORD   (required in production; in dev a placeholder is used)
 *
 * Run: pnpm --filter @pasha9/database seed
 *
 * Built by Anointed Coder.
 */

import { PrismaClient, SettingCategory, ContentStatus, ProviderStatus, GameStatus } from '@prisma/client';
import bcrypt from 'bcrypt';

const db = new PrismaClient();

const log = (msg: string) => console.log(`[seed] ${msg}`);

const isProd = process.env.NODE_ENV === 'production';
const BCRYPT_ROUNDS = 12;

async function seedRolesAndPermissions() {
  log('roles + permissions');

  const roles = [
    { key: 'super_admin', label: 'Super Admin', isSystem: true },
    { key: 'admin', label: 'Admin', isSystem: true },
    { key: 'staff', label: 'Staff', isSystem: true },
    { key: 'user', label: 'Player', isSystem: true },
  ];

  for (const r of roles) {
    await db.role.upsert({
      where: { key: r.key },
      update: { label: r.label, isSystem: r.isSystem },
      create: r,
    });
  }

  // Permission keys mirror admin route groups. Granular enough for staff RBAC in M2.
  const permissions = [
    { key: 'users.read', label: 'View users', group: 'users' },
    { key: 'users.update', label: 'Update user status and profile', group: 'users' },
    { key: 'users.balance.adjust', label: 'Adjust user balance', group: 'users' },
    { key: 'deposits.read', label: 'View deposits', group: 'wallet' },
    { key: 'deposits.review', label: 'Approve or reject deposits', group: 'wallet' },
    { key: 'withdrawals.read', label: 'View withdrawals', group: 'wallet' },
    { key: 'withdrawals.review', label: 'Approve or reject withdrawals', group: 'wallet' },
    { key: 'transactions.read', label: 'View transaction log', group: 'wallet' },
    { key: 'banners.write', label: 'Manage banners', group: 'content' },
    { key: 'popups.write', label: 'Manage popups', group: 'content' },
    { key: 'promo.write', label: 'Manage promo text', group: 'content' },
    { key: 'homepage.write', label: 'Edit homepage content', group: 'content' },
    { key: 'categories.write', label: 'Manage categories', group: 'games' },
    { key: 'providers.write', label: 'Manage providers', group: 'games' },
    { key: 'games.write', label: 'Manage games', group: 'games' },
    { key: 'bonus.write', label: 'Manage bonus rules', group: 'bonus' },
    { key: 'referrals.read', label: 'View referrals', group: 'referrals' },
    { key: 'affiliate.read', label: 'View affiliate applications and members', group: 'affiliate' },
    { key: 'affiliate.write', label: 'Approve, reject and manage affiliates', group: 'affiliate' },
    { key: 'affiliate.tiers.write', label: 'Manage commission tier settings', group: 'affiliate' },
    { key: 'ambassador.write', label: 'Edit ambassador and promo video', group: 'content' },
    { key: 'lotto.write', label: 'Manage lotto draws', group: 'content' },
    { key: 'rewards.write', label: 'Manage reward catalog', group: 'content' },
    { key: 'settings.write', label: 'Edit system settings', group: 'system' },
    { key: 'activity.read', label: 'View activity log', group: 'system' },
    { key: 'staff.manage', label: 'Manage staff accounts', group: 'system' },
  ];

  for (const p of permissions) {
    await db.permission.upsert({
      where: { key: p.key },
      update: { label: p.label, group: p.group },
      create: p,
    });
  }

  const superAdminRole = await db.role.findUniqueOrThrow({ where: { key: 'super_admin' } });
  const allPerms = await db.permission.findMany();
  for (const p of allPerms) {
    await db.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: superAdminRole.id, permissionId: p.id } },
      update: {},
      create: { roleId: superAdminRole.id, permissionId: p.id },
    });
  }

  const adminRole = await db.role.findUniqueOrThrow({ where: { key: 'admin' } });
  const adminScope = allPerms.filter((p) => p.key !== 'staff.manage' && p.key !== 'settings.write');
  for (const p of adminScope) {
    await db.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: adminRole.id, permissionId: p.id } },
      update: {},
      create: { roleId: adminRole.id, permissionId: p.id },
    });
  }

  const staffRole = await db.role.findUniqueOrThrow({ where: { key: 'staff' } });
  const staffScope = allPerms.filter((p) =>
    [
      'users.read',
      'deposits.read',
      'deposits.review',
      'withdrawals.read',
      'withdrawals.review',
      'transactions.read',
      'referrals.read',
      'affiliate.read',
    ].includes(p.key),
  );
  for (const p of staffScope) {
    await db.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: staffRole.id, permissionId: p.id } },
      update: {},
      create: { roleId: staffRole.id, permissionId: p.id },
    });
  }
}

async function seedSuperAdmin() {
  log('super admin user');
  const username = process.env.SEED_SUPERADMIN_USERNAME ?? 'pasha9.admin';
  const phone = process.env.SEED_SUPERADMIN_PHONE ?? '01700000001';
  const password = process.env.SEED_SUPERADMIN_PASSWORD;

  if (!password && isProd) {
    throw new Error('SEED_SUPERADMIN_PASSWORD must be set in production');
  }
  const effective = password ?? 'pasha9-dev-admin';
  if (!password) {
    console.warn('[seed] SEED_SUPERADMIN_PASSWORD not set, using dev placeholder "pasha9-dev-admin"');
  }
  const passwordHash = await bcrypt.hash(effective, BCRYPT_ROUNDS);

  const role = await db.role.findUniqueOrThrow({ where: { key: 'super_admin' } });
  const existing = await db.user.findUnique({ where: { username } });

  if (existing) {
    log(`super admin "${username}" already exists, skipping`);
    return existing;
  }

  return db.user.create({
    data: {
      username,
      phone,
      passwordHash,
      passwordChangedAt: new Date(),
      roleId: role.id,
      status: 'active',
      country: 'BD',
      language: 'bn',
      referralCode: 'ADMIN0001',
      wallet: { create: { balance: 0 } },
    },
  });
}

async function seedHomepageContent() {
  log('homepage content');
  const sections = [
    {
      section: 'hero_primary',
      titleBn: 'আজই খেলুন, জিতুন, আর বোনাস দাবি করুন',
      titleEn: 'Play smarter, win bigger, claim your bonus',
      bodyBn: 'প্রথম ডিপোজিটে পাচ্ছেন বিশেষ অতিরিক্ত বোনাস',
      bodyEn: 'Special first deposit bonus waiting for new players',
    },
    {
      section: 'hero_live',
      titleBn: 'প্রিমিয়াম লাইভ ক্যাসিনো অভিজ্ঞতা',
      titleEn: 'Premium live casino experience',
      bodyBn: 'বাংলাদেশের সেরা প্রোভাইডারদের সাথে নিরাপদ খেলা',
      bodyEn: 'Trusted providers, safe play, real-time action',
    },
    {
      section: 'hero_referral',
      titleBn: 'বন্ধু আমন্ত্রণ করুন এবং কমিশন পান',
      titleEn: 'Invite friends and earn commission',
      bodyBn: 'তিন স্তরের রেফারেল কমিশন কাঠামো',
      bodyEn: 'Three-level referral structure with daily payouts',
    },
    {
      section: 'about',
      titleBn: 'পাশা৯ সম্পর্কে',
      titleEn: 'About Pasha9',
      bodyBn: 'পাশা৯ বাংলাদেশের জন্য তৈরি একটি প্রিমিয়াম গেমিং প্ল্যাটফর্ম।',
      bodyEn: 'Pasha9 is a premium gaming platform built for Bangladesh.',
    },
  ];

  for (const s of sections) {
    await db.homepageContent.upsert({
      where: { section: s.section },
      update: s,
      create: s,
    });
  }
}

async function seedBanners() {
  log('banners');
  const banners = [
    { position: 1, title: 'প্রথম ডিপোজিটে ১০০% বোনাস', titleEn: 'First Deposit 100% Bonus', subtitle: 'মাত্র ৫০০ টাকা থেকে শুরু করুন', subtitleEn: 'Start with 500 BDT', accent: 'gold', ctaLabel: 'রেজিস্টার', link: '/promotions' },
    { position: 2, title: 'প্রিমিয়াম লাইভ ক্যাসিনো', titleEn: 'Premium Live Casino', subtitle: 'প্রকৃত ডিলার, স্বচ্ছ গেম', subtitleEn: 'Real dealers, fair play', accent: 'neon', ctaLabel: 'খুলুন', link: '/live-casino' },
    { position: 3, title: 'রেফারেল কমিশন প্রতিদিন', titleEn: 'Daily Referral Commission', subtitle: 'তিন স্তরের কমিশন', subtitleEn: 'Three-level commission', accent: 'mixed', ctaLabel: 'চালু করুন', link: '/referral' },
  ];

  for (const b of banners) {
    const existing = await db.banner.findFirst({ where: { position: b.position } });
    if (existing) {
      await db.banner.update({ where: { id: existing.id }, data: b });
    } else {
      await db.banner.create({ data: b });
    }
  }
}

async function seedPopups() {
  log('popups');
  const popup = {
    title: 'সাপ্তাহিক রিওয়ার্ড লাইভ',
    body: 'প্রতি শুক্রবার রাত ১০টায় সাপ্তাহিক টপ ব্যবহারকারীদের পুরস্কার বিতরণ। প্রমোশন পেজে বিস্তারিত দেখুন।',
    ctaLabel: 'প্রমোশন দেখুন',
    ctaHref: '/promotions',
    status: ContentStatus.active,
  };
  const existing = await db.popupAnnouncement.findFirst({ where: { title: popup.title } });
  if (existing) {
    await db.popupAnnouncement.update({ where: { id: existing.id }, data: popup });
  } else {
    await db.popupAnnouncement.create({ data: popup });
  }
}

async function seedPromoText() {
  log('promo text');
  const items = [
    { position: 1, message: 'প্রথম ডিপোজিটে ১০০% বোনাস। আজই দাবি করুন।' },
    { position: 2, message: 'রেফারেল করে প্রতিদিন বাড়তি ইনকাম।' },
    { position: 3, message: 'প্রিমিয়াম লাইভ ক্যাসিনো এখন আপনার হাতের মুঠোয়।' },
    { position: 4, message: 'সব লেনদেন এনক্রিপ্টেড এবং নিরাপদ।' },
  ];
  for (const p of items) {
    const existing = await db.promoText.findFirst({ where: { position: p.position } });
    if (existing) {
      await db.promoText.update({ where: { id: existing.id }, data: p });
    } else {
      await db.promoText.create({ data: p });
    }
  }
}

async function seedCategories() {
  log('game categories');
  const categories = [
    { slug: 'hot', nameBn: 'হট গেমস', nameEn: 'Hot Games', iconKey: 'flame', position: 1 },
    { slug: 'slots', nameBn: 'স্লট', nameEn: 'Slots', iconKey: 'slot', position: 2 },
    { slug: 'live-casino', nameBn: 'লাইভ ক্যাসিনো', nameEn: 'Live Casino', iconKey: 'casino', position: 3 },
    { slug: 'fishing', nameBn: 'ফিশিং', nameEn: 'Fishing', iconKey: 'fish', position: 4 },
    { slug: 'sports', nameBn: 'স্পোর্টস', nameEn: 'Sports', iconKey: 'sport', position: 5 },
    { slug: 'lottery', nameBn: 'লটারি', nameEn: 'Lottery', iconKey: 'ticket', position: 6 },
    { slug: 'poker', nameBn: 'পোকার', nameEn: 'Poker', iconKey: 'card', position: 7 },
    { slug: 'esports', nameBn: 'ই-স্পোর্টস', nameEn: 'E-Sports', iconKey: 'esport', position: 8 },
  ];
  for (const c of categories) {
    await db.gameCategory.upsert({ where: { slug: c.slug }, update: c, create: c });
  }
}

async function seedProviders() {
  log('game providers');
  const providers = [
    { name: 'Dragon Studio' },
    { name: 'Royal Bengal Labs' },
    { name: 'Emerald Stack' },
    { name: 'Sapphire Live' },
    { name: 'Lotus Origin' },
  ];
  for (const p of providers) {
    await db.gameProvider.upsert({ where: { name: p.name }, update: { status: ProviderStatus.active }, create: p });
  }
}

async function seedGames() {
  log('sample games');
  const slots = await db.gameCategory.findUniqueOrThrow({ where: { slug: 'slots' } });
  const live = await db.gameCategory.findUniqueOrThrow({ where: { slug: 'live-casino' } });
  const fishing = await db.gameCategory.findUniqueOrThrow({ where: { slug: 'fishing' } });
  const dragon = await db.gameProvider.findUniqueOrThrow({ where: { name: 'Dragon Studio' } });
  const royal = await db.gameProvider.findUniqueOrThrow({ where: { name: 'Royal Bengal Labs' } });

  const games = [
    { name: 'Bengal Tiger Spin', nameBn: 'বেঙ্গল টাইগার স্পিন', categoryId: slots.id, providerId: royal.id, accent: 'royal', isFeatured: true, minBet: 10, maxBet: 5000, houseEdge: 3, riskLevel: 'medium' },
    { name: 'Royal Dragon Gold', nameBn: 'রয়্যাল ড্রাগন গোল্ড', categoryId: slots.id, providerId: dragon.id, accent: 'gold', isFeatured: true, minBet: 10, maxBet: 10000, houseEdge: 4, riskLevel: 'high' },
    { name: 'Lotus Fortune', nameBn: 'লোটাস ফরচুন', categoryId: slots.id, providerId: royal.id, accent: 'neon', isFeatured: true, minBet: 20, maxBet: 5000, houseEdge: 3, riskLevel: 'low' },
    { name: 'Live Andar Bahar', nameBn: 'লাইভ আন্দর বাহার', categoryId: live.id, providerId: dragon.id, accent: 'red', isFeatured: true, minBet: 50, maxBet: 25000, houseEdge: 2, riskLevel: 'medium' },
    { name: 'Live Teen Patti', nameBn: 'লাইভ তিন পত্তি', categoryId: live.id, providerId: dragon.id, accent: 'gold', isFeatured: true, minBet: 50, maxBet: 25000, houseEdge: 2, riskLevel: 'medium' },
    { name: 'Live Baccarat Royal', nameBn: 'লাইভ ব্যাকারাট রয়্যাল', categoryId: live.id, providerId: royal.id, accent: 'royal', isFeatured: true, minBet: 100, maxBet: 50000, houseEdge: 1.5, riskLevel: 'low' },
    { name: 'Big Bass Hunt', nameBn: 'বিগ বাস হান্ট', categoryId: fishing.id, providerId: royal.id, accent: 'royal', isFeatured: false, minBet: 10, maxBet: 5000, houseEdge: 5, riskLevel: 'high' },
    { name: 'Ocean Reef King', nameBn: 'ওশান রীফ কিং', categoryId: fishing.id, providerId: dragon.id, accent: 'neon', isFeatured: true, minBet: 10, maxBet: 5000, houseEdge: 5, riskLevel: 'high' },
  ];

  for (const g of games) {
    const existing = await db.game.findFirst({ where: { name: g.name } });
    if (existing) {
      await db.game.update({ where: { id: existing.id }, data: { ...g, status: GameStatus.active } });
    } else {
      await db.game.create({ data: g });
    }
  }
}

async function seedPaymentMethods() {
  log('payment methods');
  const methods = [
    { name: 'bKash', type: 'mobile', number: '01700-000001', instruction: 'Send Money to the displayed bKash number, then enter the TX ID.', position: 1 },
    { name: 'Nagad', type: 'mobile', number: '01710-000002', instruction: 'Use Send Money on the Nagad app to the displayed number.', position: 2 },
    { name: 'Rocket', type: 'mobile', number: '01720-000003', instruction: 'Send to the Rocket account and submit the receipt screenshot.', position: 3 },
    { name: 'Bank Transfer', type: 'bank', number: 'Account 200-122-998877', instruction: 'Transfer to the displayed account. Reference your username in the description.', position: 4 },
    { name: 'USDT TRC20', type: 'crypto', number: 'TRC20 wallet to be configured', instruction: 'Send only USDT on TRC20 network. Confirmation may take up to 10 minutes.', position: 5 },
  ];
  for (const m of methods) {
    await db.paymentMethod.upsert({ where: { name: m.name }, update: m, create: m });
  }
}

async function seedSystemSettings() {
  log('system settings');
  const items: Array<{ key: string; value: string; type: string; category: SettingCategory }> = [
    { key: 'site_name', value: 'Pasha 9', type: 'string', category: SettingCategory.general },
    { key: 'site_domain', value: 'pasha9.com', type: 'string', category: SettingCategory.general },
    // Client-owned public support contacts. Left empty intentionally so the operator fills
    // them from the admin Settings page; the public site hides any channel that is still empty.
    { key: 'support_telegram', value: '', type: 'string', category: SettingCategory.general },
    { key: 'support_whatsapp', value: '', type: 'string', category: SettingCategory.general },
    { key: 'support_email', value: '', type: 'string', category: SettingCategory.general },
    { key: 'apk_download_url', value: '', type: 'string', category: SettingCategory.apk },
    { key: 'apk_version', value: '', type: 'string', category: SettingCategory.apk },
    // Ambassador and promo video, edited from /admin/ambassador
    { key: 'ambassador_name', value: '', type: 'string', category: SettingCategory.content },
    { key: 'ambassador_caption', value: '', type: 'string', category: SettingCategory.content },
    { key: 'ambassador_image_url', value: '', type: 'string', category: SettingCategory.content },
    { key: 'ambassador_active', value: 'true', type: 'boolean', category: SettingCategory.content },
    { key: 'video_promo_title', value: '', type: 'string', category: SettingCategory.content },
    { key: 'video_promo_caption', value: '', type: 'string', category: SettingCategory.content },
    { key: 'video_promo_url', value: '', type: 'string', category: SettingCategory.content },
    { key: 'video_promo_poster_url', value: '', type: 'string', category: SettingCategory.content },
    { key: 'sms_provider', value: '', type: 'string', category: SettingCategory.sms },
    { key: 'sms_api_key', value: '', type: 'string', category: SettingCategory.sms },
    { key: 'sms_sender_id', value: '', type: 'string', category: SettingCategory.sms },
    { key: 'otp_expiry_minutes', value: '5', type: 'number', category: SettingCategory.sms },
    { key: 'pixel_facebook', value: '', type: 'string', category: SettingCategory.tracking },
    { key: 'pixel_tiktok', value: '', type: 'string', category: SettingCategory.tracking },
    { key: 'analytics_ga4', value: '', type: 'string', category: SettingCategory.tracking },
    { key: 'analytics_google_ads', value: '', type: 'string', category: SettingCategory.tracking },
    { key: 'referral_level1_pct', value: '8', type: 'number', category: SettingCategory.referral },
    { key: 'referral_level2_pct', value: '4', type: 'number', category: SettingCategory.referral },
    { key: 'referral_level3_pct', value: '2', type: 'number', category: SettingCategory.referral },
    { key: 'min_deposit', value: '500', type: 'number', category: SettingCategory.payment },
    { key: 'min_withdrawal', value: '500', type: 'number', category: SettingCategory.payment },
    { key: 'max_withdrawal_per_request', value: '200000', type: 'number', category: SettingCategory.payment },
  ];

  for (const s of items) {
    await db.systemSetting.upsert({
      where: { key: s.key },
      update: { type: s.type, category: s.category, value: s.value },
      create: s,
    });
  }
}

async function seedCommissionTiers() {
  log('commission tiers');
  const tiers = [
    {
      name: 'bronze',
      description: 'Entry tier for new affiliates. Earn 8 / 4 / 2 percent across three downline levels.',
      level1Pct: 8.0,
      level2Pct: 4.0,
      level3Pct: 2.0,
      minActiveReferrals: 0,
      minMonthlyVolume: 0,
      position: 1,
    },
    {
      name: 'silver',
      description: 'Mid tier unlocked once 10 referrals are active and monthly volume hits 50,000 BDT.',
      level1Pct: 10.0,
      level2Pct: 5.0,
      level3Pct: 2.0,
      minActiveReferrals: 10,
      minMonthlyVolume: 50000,
      position: 2,
    },
    {
      name: 'gold',
      description: 'Top tier for high-performing affiliates with 30+ active referrals and 200,000+ BDT monthly volume.',
      level1Pct: 12.0,
      level2Pct: 6.0,
      level3Pct: 3.0,
      minActiveReferrals: 30,
      minMonthlyVolume: 200000,
      position: 3,
    },
  ];

  for (const t of tiers) {
    await db.commissionTier.upsert({
      where: { name: t.name },
      update: {
        description: t.description,
        level1Pct: t.level1Pct,
        level2Pct: t.level2Pct,
        level3Pct: t.level3Pct,
        minActiveReferrals: t.minActiveReferrals,
        minMonthlyVolume: t.minMonthlyVolume,
        position: t.position,
      },
      create: t,
    });
  }
}

async function seedLottoDraws() {
  log('lotto draws');
  const draws = [
    { name: 'Daily 4D', schedule: 'Daily 21:00', digitsCount: 4, ticketPrice: 20, prizePool: 1_500_000, accent: 'yellow', position: 1 },
    { name: 'Mega Friday', schedule: 'Friday 22:30', digitsCount: 5, ticketPrice: 50, prizePool: 8_500_000, accent: 'red', position: 2 },
    { name: 'Numbers Rush', schedule: 'Daily 17:30', digitsCount: 3, ticketPrice: 10, prizePool: 450_000, accent: 'blue', position: 3 },
    { name: 'Lotto Super 6', schedule: 'Saturday 20:00', digitsCount: 6, ticketPrice: 30, prizePool: 3_200_000, accent: 'royal', position: 4 },
  ];
  for (const d of draws) {
    const existing = await db.lottoDraw.findFirst({ where: { name: d.name } });
    if (existing) {
      await db.lottoDraw.update({ where: { id: existing.id }, data: d });
    } else {
      await db.lottoDraw.create({ data: d });
    }
  }
}

async function seedNativeGames() {
  log('native games (Pasha Dice + Mines)');
  // Two playable in-house games, kept idempotent via the unique
  // gameCode column. Caps + house edge mirror the defaults declared in
  // apps/web/lib/native-games/config.ts so a fresh seed matches the
  // engine's expectations exactly.
  const defaults = [
    {
      gameCode: 'dice',
      displayName: 'Pasha Dice',
      isActive: true,
      houseEdgeBps: 200,
      minBet: 10,
      maxBet: 10_000,
      config: { minTarget: 2, maxTarget: 98 } as Record<string, number>,
    },
    {
      gameCode: 'mines',
      displayName: 'Pasha Mines',
      isActive: true,
      houseEdgeBps: 200,
      minBet: 10,
      maxBet: 10_000,
      config: { gridSize: 25, minMines: 1, maxMines: 24 } as Record<string, number>,
    },
  ];
  for (const g of defaults) {
    await db.nativeGameProvider.upsert({
      where: { gameCode: g.gameCode },
      update: {
        displayName: g.displayName,
        houseEdgeBps: g.houseEdgeBps,
        config: g.config,
      },
      create: g,
    });
  }
  await db.systemSetting.upsert({
    where: { key: 'native_games_enabled' },
    update: {},
    create: { key: 'native_games_enabled', value: 'true', type: 'boolean', category: 'general' },
  });
}

async function seedRewardItems() {
  log('reward catalog');
  const items = [
    { title: 'Mobile Recharge 500', description: 'Top up any Bangladesh operator for 500 BDT', cost: 1000, category: 'recharge', accent: 'yellow', position: 1 },
    { title: 'Mobile Recharge 1000', description: 'Top up any Bangladesh operator for 1000 BDT', cost: 2000, category: 'recharge', accent: 'yellow', position: 2 },
    { title: 'Free Spins x30', description: 'Use on selected slot games', cost: 2100, category: 'spin', accent: 'red', position: 3 },
    { title: 'Free Spins x50', description: 'Use on selected slot games', cost: 3500, category: 'spin', accent: 'red', position: 4 },
    { title: 'Bluetooth Speaker', description: 'Pasha 9 partner branded speaker', cost: 4200, category: 'physical', accent: 'blue', position: 5 },
    { title: 'Free Bet 1000', description: 'Use on sportsbook markets', cost: 2400, category: 'bet', accent: 'green', position: 6 },
  ];
  for (const r of items) {
    const existing = await db.rewardItem.findFirst({ where: { title: r.title } });
    if (existing) {
      await db.rewardItem.update({ where: { id: existing.id }, data: r });
    } else {
      await db.rewardItem.create({ data: r });
    }
  }
}

async function main() {
  log('starting');
  await seedRolesAndPermissions();
  const admin = await seedSuperAdmin();
  await seedHomepageContent();
  await seedBanners();
  await seedPopups();
  await seedPromoText();
  await seedCategories();
  await seedProviders();
  await seedGames();
  await seedPaymentMethods();
  await seedSystemSettings();
  await seedCommissionTiers();
  await seedLottoDraws();
  await seedRewardItems();
  await seedNativeGames();

  log(`super admin id: ${admin.id}`);
  log('done');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
