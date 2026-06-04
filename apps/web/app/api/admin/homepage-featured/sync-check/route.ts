// Built by Anointed Coder.
//
// GET /api/admin/homepage-featured/sync-check
//
// Contract test for "the public Hot Games strip reads from the same
// ordered HomepageFeaturedGame rows shown in the admin Manager". Reads
// the curated list, calls buildHomeSections() in-process, finds the
// homepage_hot section in the assembled bundle, and computes a strict
// ordered diff using the SAME key format the public renderer uses.
// Admin UI calls this on mount and after every mutation; when
// inSync=false the Manager surfaces a red banner naming the
// missing/extra rows so the operator can self-diagnose drift.

export const dynamic = 'force-dynamic';

import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';
import { buildHomeSections } from '@/lib/homepage/sections';
import { isNativeGamesPublic } from '@/lib/native-games/flag';

// Mirrors externalToGame and nativeToGame in lib/homepage/sections.ts.
// Keep these in sync if the key format changes there.
function externalKey(externalGameId: string): string {
  return `external:${externalGameId}`;
}
function nativeKey(nativeProviderId: string): string {
  return `native:${nativeProviderId}`;
}

interface CuratedKeyRow {
  curatedId: string;
  source: 'external' | 'native';
  ref: string;          // externalGameId or nativeGameCode (operator-facing)
  expectedKey: string | null;  // null if the source row is missing
  displayName: string | null;
  resolvedReason: string | null;
}

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('homepage.write');

    const [curated, bundle, nativePublic] = await Promise.all([
      db.homepageFeaturedGame.findMany({
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      }),
      buildHomeSections(),
      isNativeGamesPublic(),
    ]);

    // Resolve each curated row to the key the assembler would have
    // emitted. For native rows the public key uses NativeGameProvider.id
    // (not gameCode), so we look it up here.
    const externalIds = curated.filter((r) => r.source === 'external' && r.externalGameId).map((r) => r.externalGameId as string);
    const nativeCodes = curated.filter((r) => r.source === 'native' && r.nativeGameCode).map((r) => r.nativeGameCode as string);

    const [externals, natives] = await Promise.all([
      externalIds.length
        ? db.externalGame.findMany({
            where: { id: { in: externalIds } },
            select: { id: true, displayName: true, status: true, provider: { select: { status: true } } },
          })
        : Promise.resolve([] as { id: string; displayName: string; status: string; provider: { status: string } | null }[]),
      nativeCodes.length
        ? db.nativeGameProvider.findMany({
            where: { gameCode: { in: nativeCodes } },
            select: { id: true, gameCode: true, displayName: true, isActive: true },
          })
        : Promise.resolve([] as { id: string; gameCode: string; displayName: string; isActive: boolean }[]),
    ]);

    const externalById = new Map(externals.map((g) => [g.id, g]));
    const nativeByCode = new Map(natives.map((g) => [g.gameCode, g]));

    const adminRows: CuratedKeyRow[] = curated.map((r) => {
      if (r.source === 'external' && r.externalGameId) {
        const ext = externalById.get(r.externalGameId);
        if (!ext) {
          return {
            curatedId: r.id,
            source: 'external',
            ref: r.externalGameId,
            expectedKey: null,
            displayName: null,
            resolvedReason: 'external_game_missing',
          };
        }
        const live = ext.status === 'active' && ext.provider?.status === 'active';
        return {
          curatedId: r.id,
          source: 'external',
          ref: r.externalGameId,
          expectedKey: live ? externalKey(ext.id) : null,
          displayName: ext.displayName,
          resolvedReason: live ? null : `external status=${ext.status}, provider status=${ext.provider?.status ?? 'missing'}`,
        };
      }
      if (r.source === 'native' && r.nativeGameCode) {
        const nat = nativeByCode.get(r.nativeGameCode);
        if (!nat) {
          return {
            curatedId: r.id,
            source: 'native',
            ref: r.nativeGameCode,
            expectedKey: null,
            displayName: null,
            resolvedReason: 'native_game_missing',
          };
        }
        if (!nat.isActive) {
          return {
            curatedId: r.id,
            source: 'native',
            ref: r.nativeGameCode,
            expectedKey: null,
            displayName: nat.displayName,
            resolvedReason: 'native_inactive',
          };
        }
        if (!nativePublic) {
          return {
            curatedId: r.id,
            source: 'native',
            ref: r.nativeGameCode,
            expectedKey: null,
            displayName: nat.displayName,
            resolvedReason: 'native_games_public_enabled=false',
          };
        }
        return {
          curatedId: r.id,
          source: 'native',
          ref: r.nativeGameCode,
          expectedKey: nativeKey(nat.id),
          displayName: nat.displayName,
          resolvedReason: null,
        };
      }
      return {
        curatedId: r.id,
        source: r.source as 'external' | 'native',
        ref: r.externalGameId ?? r.nativeGameCode ?? '',
        expectedKey: null,
        displayName: null,
        resolvedReason: 'missing_reference',
      };
    });

    const hotSection = bundle.sections.find((s) => s.key === 'homepage_hot');
    const publicKeys = (hotSection?.games ?? []).map((g) => g.key);
    const expectedKeys = adminRows.map((r) => r.expectedKey).filter((k): k is string => Boolean(k));

    // Ordered strict comparison: each expected key at index i must
    // equal publicKeys[i]. Mismatches at any index break the chain.
    const missingFromPublic = expectedKeys.filter((k) => !publicKeys.includes(k));
    const extraInPublic = publicKeys.filter((k) => !expectedKeys.includes(k));
    const sameOrder = expectedKeys.every((k, i) => publicKeys[i] === k) && publicKeys.length === expectedKeys.length;
    const inSync = sameOrder && missingFromPublic.length === 0 && extraInPublic.length === 0;

    // Surface PublicSection.homepage_hot state separately so the
    // operator can see whether the row exists and is visible.
    const hotRow = await db.publicSection.findUnique({
      where: { key: 'homepage_hot' },
      select: { key: true, isVisible: true, titleEn: true, position: true },
    });

    return jsonOk({
      ok: true,
      inSync,
      sameOrder,
      curatedCount: curated.length,
      renderableCuratedCount: expectedKeys.length,
      publicCount: publicKeys.length,
      missingFromPublic,
      extraInPublic,
      adminRows,
      publicKeys,
      hotSection: {
        present: Boolean(hotSection),
        isVisible: hotSection?.isVisible ?? null,
        gamesLength: hotSection?.games.length ?? 0,
        sourceRowExists: Boolean(hotRow),
        sourceRowIsVisible: hotRow?.isVisible ?? null,
        sourceRowTitleEn: hotRow?.titleEn ?? null,
      },
      flags: {
        nativeGamesPublicEnabled: nativePublic,
      },
      blockedCuratedRows: bundle.blockedCuratedRows,
    });
  });
}
