// Built by Anointed Coder.
//
// GET /api/admin/homepage-featured/debug
//
// Operator-facing verification snapshot for the Featured Game Manager.
// Returns:
//   - PublicSection homepage row count + whether homepage_hot exists
//   - HomepageFeaturedGame row count
//   - First 20 curated rows with position, source, externalGameId,
//     game name, brand, status, and a `renderable` flag indicating
//     whether the public homepage will surface the row
//   - native_games_public_enabled flag value
//
// No secrets are exposed. The endpoint is gated by homepage.write so
// only operators with the section-editor permission see it.

export const dynamic = 'force-dynamic';

import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';
import { isNativeGamesPublic } from '@/lib/native-games/flag';

const SNAPSHOT_LIMIT = 20;

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('homepage.write');

    const [sections, featured, nativePublic] = await Promise.all([
      db.publicSection.findMany({
        where: { group: 'homepage' },
        orderBy: [{ position: 'asc' }, { titleEn: 'asc' }],
        select: { key: true, position: true, titleEn: true, isVisible: true, layout: true },
      }),
      db.homepageFeaturedGame.findMany({
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        take: SNAPSHOT_LIMIT,
      }),
      isNativeGamesPublic(),
    ]);

    const externalIds = featured.filter((r) => r.source === 'external' && r.externalGameId).map((r) => r.externalGameId as string);
    const nativeCodes = featured.filter((r) => r.source === 'native' && r.nativeGameCode).map((r) => r.nativeGameCode as string);

    const [externals, natives] = await Promise.all([
      externalIds.length
        ? db.externalGame.findMany({
            where: { id: { in: externalIds } },
            select: {
              id: true,
              displayName: true,
              status: true,
              provider: { select: { name: true, status: true } },
              brand: { select: { displayName: true } },
            },
          })
        : Promise.resolve([] as {
            id: string;
            displayName: string;
            status: string;
            provider: { name: string; status: string } | null;
            brand: { displayName: string } | null;
          }[]),
      nativeCodes.length
        ? db.nativeGameProvider.findMany({
            where: { gameCode: { in: nativeCodes } },
            select: { gameCode: true, displayName: true, isActive: true },
          })
        : Promise.resolve([] as { gameCode: string; displayName: string; isActive: boolean }[]),
    ]);

    const externalById = new Map(externals.map((g) => [g.id, g]));
    const nativeByCode = new Map(natives.map((g) => [g.gameCode, g]));

    const rows = featured.map((r) => {
      const ext = r.externalGameId ? externalById.get(r.externalGameId) ?? null : null;
      const nat = r.nativeGameCode ? nativeByCode.get(r.nativeGameCode) ?? null : null;
      const renderable = r.source === 'external'
        ? Boolean(ext && ext.status === 'active' && ext.provider?.status === 'active')
        : Boolean(nat && nat.isActive && nativePublic);
      let blockedReason: string | null = null;
      if (!renderable) {
        if (r.source === 'external') {
          if (!ext) blockedReason = 'external game row missing';
          else if (ext.status !== 'active') blockedReason = `external game status=${ext.status}`;
          else if (ext.provider?.status !== 'active') blockedReason = `provider status=${ext.provider?.status ?? 'missing'}`;
        } else {
          if (!nat) blockedReason = 'native game row missing';
          else if (!nat.isActive) blockedReason = 'native game inactive';
          else if (!nativePublic) blockedReason = 'native_games_public_enabled=false';
        }
      }
      return {
        id: r.id,
        position: r.position,
        source: r.source,
        externalGameId: r.externalGameId,
        nativeGameCode: r.nativeGameCode,
        isHot: r.isHot,
        isJackpot: r.isJackpot,
        gameName: ext?.displayName ?? nat?.displayName ?? '(removed)',
        brand: ext?.brand?.displayName ?? null,
        provider: ext?.provider?.name ?? (r.source === 'native' ? 'Pasha Originals' : null),
        gameStatus: ext?.status ?? (nat ? (nat.isActive ? 'active' : 'inactive') : 'missing'),
        renderable,
        blockedReason,
      };
    });

    const homepageHotPresent = sections.some((s) => s.key === 'homepage_hot');
    const renderableCount = rows.filter((r) => r.renderable).length;

    return jsonOk({
      ok: true,
      generatedAt: new Date().toISOString(),
      publicSection: {
        group: 'homepage',
        count: sections.length,
        homepageHotPresent,
        rows: sections,
      },
      homepageFeaturedGame: {
        count: featured.length,
        renderableCount,
        rows,
      },
      flags: {
        nativeGamesPublicEnabled: nativePublic,
      },
      health: {
        seedMissing: !homepageHotPresent && featured.length > 0,
        renderingSynthetic: !homepageHotPresent && renderableCount > 0,
      },
    });
  });
}
