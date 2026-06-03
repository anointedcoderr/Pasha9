// Built by Anointed Coder.
//
// Custom homepage block assembler. Reads HomepageGameBlock rows and
// fills each with games based on its sourceType:
//   manual    -> HomepageGameBlockItem rows
//   category  -> live ExternalGame rows matching category (case-insensitive)
//   brand     -> live ExternalGame rows for the brand
//   jackpot   -> live ExternalGame rows where isJackpot=true
//   featured  -> top isFeatured rows
// Blocks with no games render nothing on the public homepage.

import { db } from '@/lib/db/client';
import type { HomeSectionGame } from './sections';
import { isNativeGamesPublic } from '@/lib/native-games/flag';

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 30;

export interface HomeBlock {
  id: string;
  key: string;
  titleEn: string;
  titleBn: string | null;
  subtitleEn: string | null;
  subtitleBn: string | null;
  sourceType: 'manual' | 'category' | 'brand' | 'jackpot' | 'featured';
  category: string | null;
  brandKey: string | null;
  brandName: string | null;
  layout: string;
  position: number;
  href: string;
  games: HomeSectionGame[];
}

interface ExternalGameRow {
  id: string;
  providerId: string;
  gameUid: string;
  displayName: string;
  category: string | null;
  imageUrl: string | null;
  isFeatured: boolean;
  isJackpot: boolean;
  jackpotLabel: string | null;
  sortOrder: number;
  status: string;
  provider: { providerKey: string | null; name: string; status: string };
  brand: { displayName: string; brandKey: string } | null;
}

interface NativeGameRow {
  id: string;
  gameCode: string;
  displayName: string;
  isActive: boolean;
  minBet: { toString: () => string } | number | null;
}

function externalToGame(row: ExternalGameRow, hot = false, jackpot = false): HomeSectionGame {
  return {
    key: `external:${row.id}`,
    source: 'external',
    providerKey: row.provider.providerKey,
    providerName: row.provider.name,
    gameUid: row.gameUid,
    gameCode: null,
    displayName: row.displayName,
    category: row.category,
    imageUrl: row.imageUrl,
    brandName: row.brand?.displayName ?? null,
    isHot: hot,
    isJackpot: jackpot || row.isJackpot,
    minBet: null,
    href: row.provider.providerKey
      ? `/games/provider?provider=${encodeURIComponent(row.provider.providerKey)}&game=${encodeURIComponent(row.gameUid)}`
      : null,
  };
}

function nativeToGame(row: NativeGameRow, hot = false, jackpot = false): HomeSectionGame {
  const minBet = typeof row.minBet === 'number' ? row.minBet : row.minBet ? Number(row.minBet.toString()) : null;
  return {
    key: `native:${row.id}`,
    source: 'native',
    providerKey: null,
    providerName: 'Pasha Originals',
    gameUid: null,
    gameCode: row.gameCode,
    displayName: row.displayName,
    category: null,
    imageUrl: null,
    brandName: null,
    isHot: hot,
    isJackpot: jackpot,
    minBet,
    href: `/games/${row.gameCode}`,
  };
}

const externalGameSelect = {
  id: true,
  providerId: true,
  gameUid: true,
  displayName: true,
  category: true,
  imageUrl: true,
  isFeatured: true,
  isJackpot: true,
  jackpotLabel: true,
  sortOrder: true,
  status: true,
  provider: { select: { providerKey: true, name: true, status: true } },
  brand: { select: { displayName: true, brandKey: true } },
};

async function fillManual(blockId: string, limit: number): Promise<HomeSectionGame[]> {
  const items = await db.homepageGameBlockItem.findMany({
    where: { blockId },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    take: limit,
  });
  if (items.length === 0) return [];

  const externalIds = items.filter((r) => r.source === 'external' && r.externalGameId).map((r) => r.externalGameId as string);
  const nativeCodes = items.filter((r) => r.source === 'native' && r.nativeGameCode).map((r) => r.nativeGameCode as string);

  const [externals, natives] = await Promise.all([
    externalIds.length
      ? db.externalGame.findMany({
          where: { id: { in: externalIds }, status: 'active', provider: { status: 'active' } },
          select: externalGameSelect,
        })
      : Promise.resolve([] as ExternalGameRow[]),
    nativeCodes.length
      ? db.nativeGameProvider.findMany({
          where: { gameCode: { in: nativeCodes }, isActive: true },
          select: { id: true, gameCode: true, displayName: true, isActive: true, minBet: true },
        })
      : Promise.resolve([] as NativeGameRow[]),
  ]);

  const externalById = new Map((externals as ExternalGameRow[]).map((g) => [g.id, g]));
  const nativeByCode = new Map((natives as NativeGameRow[]).map((g) => [g.gameCode, g]));

  const games: HomeSectionGame[] = [];
  for (const r of items) {
    if (r.source === 'external' && r.externalGameId) {
      const g = externalById.get(r.externalGameId);
      if (!g) continue;
      games.push(externalToGame(g, r.isHot, r.isJackpot));
    } else if (r.source === 'native' && r.nativeGameCode) {
      const g = nativeByCode.get(r.nativeGameCode);
      if (!g) continue;
      games.push(nativeToGame(g, r.isHot, r.isJackpot));
    }
  }
  return games;
}

async function fillCategory(category: string, limit: number): Promise<HomeSectionGame[]> {
  const rows = await db.externalGame.findMany({
    where: {
      status: 'active',
      provider: { status: 'active' },
      category: { contains: category, mode: 'insensitive' },
    },
    orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'desc' }, { displayName: 'asc' }],
    take: limit,
    select: externalGameSelect,
  });
  return (rows as ExternalGameRow[]).map((r) => externalToGame(r));
}

async function fillBrand(brandId: string, limit: number): Promise<HomeSectionGame[]> {
  const rows = await db.externalGame.findMany({
    where: { status: 'active', provider: { status: 'active' }, brandId },
    orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'desc' }, { displayName: 'asc' }],
    take: limit,
    select: externalGameSelect,
  });
  return (rows as ExternalGameRow[]).map((r) => externalToGame(r));
}

async function fillJackpot(limit: number): Promise<HomeSectionGame[]> {
  const rows = await db.externalGame.findMany({
    where: { status: 'active', provider: { status: 'active' }, isJackpot: true },
    orderBy: [{ isFeatured: 'desc' }, { sortOrder: 'desc' }, { displayName: 'asc' }],
    take: limit,
    select: externalGameSelect,
  });
  return (rows as ExternalGameRow[]).map((r) => externalToGame(r, false, true));
}

async function fillFeatured(limit: number): Promise<HomeSectionGame[]> {
  const rows = await db.externalGame.findMany({
    where: { status: 'active', provider: { status: 'active' }, isFeatured: true },
    orderBy: [{ sortOrder: 'desc' }, { displayName: 'asc' }],
    take: limit,
    select: externalGameSelect,
  });
  return (rows as ExternalGameRow[]).map((r) => externalToGame(r, true, false));
}

function hrefFor(sourceType: HomeBlock['sourceType'], category: string | null, brandKey: string | null): string {
  if (sourceType === 'category' && category) return `/games/provider?category=${encodeURIComponent(category)}`;
  if (sourceType === 'brand' && brandKey) return `/games/provider?brand=${encodeURIComponent(brandKey)}`;
  if (sourceType === 'jackpot') return '/games/provider?jackpot=1';
  if (sourceType === 'featured') return '/games/provider?featured=1';
  return '/games/provider';
}

export async function buildHomeBlocks(): Promise<HomeBlock[]> {
  const blocks = await db.homepageGameBlock.findMany({
    where: { isVisible: true },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  });
  if (blocks.length === 0) return [];

  // When the public native flag is off, filter native games out of
  // every manual block so the operator does not have to clean up
  // historical selections one by one. Existing external picks stay.
  const showNative = await isNativeGamesPublic();

  const brandIds = blocks.filter((b) => b.brandId).map((b) => b.brandId as string);
  const brands = brandIds.length
    ? await db.providerBrand.findMany({ where: { id: { in: brandIds } }, select: { id: true, brandKey: true, displayName: true } })
    : [];
  const brandById = new Map(brands.map((b) => [b.id, b]));

  const out: HomeBlock[] = [];
  for (const b of blocks) {
    const limit = Math.min(Math.max(b.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
    let games: HomeSectionGame[] = [];
    const sourceType = (b.sourceType ?? 'manual') as HomeBlock['sourceType'];
    if (sourceType === 'manual') games = await fillManual(b.id, limit);
    else if (sourceType === 'category' && b.category) games = await fillCategory(b.category, limit);
    else if (sourceType === 'brand' && b.brandId) games = await fillBrand(b.brandId, limit);
    else if (sourceType === 'jackpot') games = await fillJackpot(limit);
    else if (sourceType === 'featured') games = await fillFeatured(limit);

    if (!showNative) games = games.filter((g) => g.source !== 'native');

    if (games.length === 0) continue;

    const brand = b.brandId ? brandById.get(b.brandId) ?? null : null;
    out.push({
      id: b.id,
      key: b.key,
      titleEn: b.titleEn,
      titleBn: b.titleBn,
      subtitleEn: b.subtitleEn,
      subtitleBn: b.subtitleBn,
      sourceType,
      category: b.category ?? null,
      brandKey: brand?.brandKey ?? null,
      brandName: brand?.displayName ?? null,
      layout: b.layout ?? 'grid',
      position: b.position,
      href: hrefFor(sourceType, b.category ?? null, brand?.brandKey ?? null),
      games,
    });
  }
  return out;
}
