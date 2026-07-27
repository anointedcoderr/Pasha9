// Built by Anointed Coder.
//
// Admin spin wheel segment manager. The spin engine picks rows by
// weight; the operator can mix coin payouts, bonus wallet credits,
// freespin tokens and consolation no-prize wedges.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

// PayoutType keywords accepted by the spin engine. 'cash' credits the
// real BDT wallet balance with a per-segment turnover lock tracked via
// UserBonus(sourceType='spin_result_cash'). 'free_bet' does the same
// with a fixed 1x turnover. 'bonus' is the legacy lockedBalance path.
// 'coins' tops up bonusBalance (non-monetary). 'freebet' (legacy
// declared-but-inert) is kept as a no-op alias; 'freespin' is also
// declared-but-inert. 'nothing' / 'loss' record a SpinResult with no
// wallet movement.
const PAYOUT_TYPES = ['coins', 'bonus', 'cash', 'free_bet', 'freebet', 'freespin', 'nothing', 'loss'] as const;

const createSchema = z.object({
  label: z.string().trim().min(1).max(60),
  color: z.string().trim().max(20).default('#FFCC00'),
  weight: z.coerce.number().int().min(1).max(1_000_000).default(1),
  payoutType: z.enum(PAYOUT_TYPES).default('coins'),
  payoutAmount: z.coerce.number().int().min(0).max(10_000_000).default(0),
  turnoverX: z.coerce.number().min(0).max(50).default(0),
  position: z.coerce.number().int().min(0).max(99).default(0),
  isActive: z.boolean().default(true),
  // Server-only payout-eligibility flag. When true the wedge stays on
  // the visual wheel but is excluded from the engine's weighted pick.
  // NEVER returned to the public spin-wheel endpoint.
  excludeFromWins: z.boolean().optional(),
  excludeReason: z.string().trim().max(280).nullable().optional(),
  tierId: z.string().trim().min(1).max(60).nullable().optional(),
});

const patchSchema = createSchema.partial();

// Numeric payout types whose wedge label is expected to display the
// prize amount to the player. For these, if the label contains a
// number it MUST equal payoutAmount. This closes the "shows 10,
// credits 300" defect at the source: the wheel and the win modal both
// render the free-text label while the wallet is credited the separate
// payoutAmount field, so nothing stopped an operator from setting a
// label of "10" on a segment that pays 300. Flavour labels with no
// number (e.g. "TRY AGAIN", "MYSTERY") and zero-amount consolation
// wedges are exempt.
const AMOUNT_LABEL_TYPES = new Set(['coins', 'bonus', 'cash', 'free_bet']);

function labelPayoutMismatch(label: string, payoutType: string, payoutAmount: number): string | null {
  if (!AMOUNT_LABEL_TYPES.has(payoutType)) return null;
  if (!payoutAmount || payoutAmount <= 0) return null;
  // Pull every run of digits from the label, ignoring thousands
  // separators and spaces: "Win 1,000 Coins" -> [1000], "৳100" -> [100],
  // "TRY AGAIN" -> [], "10" -> [10].
  const nums = (label.replace(/[,\s]/g, '').match(/\d+/g) ?? []).map((n) => parseInt(n, 10));
  if (nums.length === 0) return null;
  if (nums.includes(payoutAmount)) return null;
  return `The wedge label "${label}" shows a different number than the amount that will be credited (${payoutAmount}). Make the label match the payout amount, or remove the number from the label.`;
}

// Fields whose change should bump the parent tier's configVersion. Any
// edit that could move the pre-spin eligible pool (weight, payout
// amount/type, active flag, exclusion flag) qualifies; cosmetic edits
// like color or label do not.
const POOL_AFFECTING_KEYS = new Set([
  'weight', 'payoutType', 'payoutAmount', 'isActive', 'excludeFromWins', 'tierId',
]);

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    await ensurePermission('rewards.write');
    const url = new URL(req.url);
    const tierFilter = url.searchParams.get('tierId');
    const where = tierFilter === 'null'
      ? { tierId: null }
      : tierFilter
        ? { tierId: tierFilter }
        : {};
    const rows = await db.spinSegment.findMany({ where, orderBy: [{ position: 'asc' }], take: 200 });
    return jsonOk({
      segments: rows.map((s) => ({
        id: s.id,
        label: s.label,
        color: s.color,
        weight: s.weight,
        payoutType: s.payoutType,
        payoutAmount: s.payoutAmount,
        turnoverX: Number(s.turnoverX),
        position: s.position,
        isActive: s.isActive,
        tierId: s.tierId,
        // Admin-only exclusion metadata. Public /api/content/spin-wheel
        // intentionally does NOT include these.
        excludeFromWins: s.excludeFromWins,
        excludeReason: s.excludeReason,
        excludeSetBy: s.excludeSetBy,
        excludeSetAt: s.excludeSetAt?.toISOString() ?? null,
      })),
    });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('rewards.write');
    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const data = parsed.data;
    const mismatch = labelPayoutMismatch(data.label, data.payoutType, data.payoutAmount);
    if (mismatch) return jsonError(400, 'LABEL_PAYOUT_MISMATCH', mismatch);
    const now = new Date();
    const row = await db.spinSegment.create({
      data: {
        label: data.label,
        color: data.color,
        weight: data.weight,
        payoutType: data.payoutType,
        payoutAmount: data.payoutAmount,
        turnoverX: data.turnoverX,
        position: data.position,
        isActive: data.isActive,
        excludeFromWins: data.excludeFromWins ?? false,
        excludeReason: data.excludeReason ?? null,
        excludeSetBy: data.excludeFromWins ? session.sub : null,
        excludeSetAt: data.excludeFromWins ? now : null,
        tierId: data.tierId ?? null,
      },
    });
    // Bump tier configVersion so the engine knows the eligible pool
    // changed for any subsequent spin on this tier.
    if (row.tierId) {
      await db.spinWheelTier.update({ where: { id: row.tierId }, data: { configVersion: { increment: 1 } } });
    }
    await db.spinSegmentAudit.create({
      data: {
        segmentId: row.id,
        actorId: session.sub,
        actorRole: session.role,
        changeType: 'create',
        reason: data.excludeFromWins ? data.excludeReason ?? null : null,
        before: Prisma.JsonNull,
        after: { ...data, id: row.id } as Prisma.InputJsonValue,
        configVersion: null,
      },
    });
    await recordActivity({ actorId: session.sub, actorRole: session.role, action: 'SPIN_SEGMENT_CREATE', target: row.id });
    return jsonOk({ segment: row }, 201);
  });
}

export async function PATCH(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('rewards.write');
    const body = await req.json().catch(() => ({}));
    const idRaw = typeof body?.id === 'string' ? body.id : null;
    if (!idRaw) return jsonError(400, 'VALIDATION', 'id required');
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const existing = await db.spinSegment.findUnique({ where: { id: idRaw } });
    if (!existing) return jsonError(404, 'SEGMENT_NOT_FOUND');

    const data = parsed.data;
    // Enforce label/payout consistency against the EFFECTIVE values
    // after this partial edit is merged onto the existing row, so a
    // label-only or amount-only edit cannot reintroduce a mismatch.
    const effLabel = data.label ?? existing.label;
    const effType = data.payoutType ?? existing.payoutType;
    const effAmount = data.payoutAmount ?? existing.payoutAmount;
    const patchMismatch = labelPayoutMismatch(effLabel, effType, effAmount);
    if (patchMismatch) return jsonError(400, 'LABEL_PAYOUT_MISMATCH', patchMismatch);
    const now = new Date();

    // Detect exclude_from_wins flip. The admin UI requires a reason
    // string to be supplied alongside the toggle so the audit trail is
    // useful; we accept the toggle without a reason for back-compat
    // but the audit row still records null.
    let excludeChanged = false;
    let excludeNext: boolean | undefined = undefined;
    if (typeof data.excludeFromWins === 'boolean' && data.excludeFromWins !== existing.excludeFromWins) {
      excludeChanged = true;
      excludeNext = data.excludeFromWins;
    }

    const updateData: Record<string, unknown> = {};
    if (data.label !== undefined) updateData.label = data.label;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.weight !== undefined) updateData.weight = data.weight;
    if (data.payoutType !== undefined) updateData.payoutType = data.payoutType;
    if (data.payoutAmount !== undefined) updateData.payoutAmount = data.payoutAmount;
    if (data.turnoverX !== undefined) updateData.turnoverX = data.turnoverX;
    if (data.position !== undefined) updateData.position = data.position;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.tierId !== undefined) updateData.tierId = data.tierId;
    if (excludeChanged) {
      updateData.excludeFromWins = excludeNext;
      updateData.excludeReason = data.excludeReason ?? null;
      updateData.excludeSetBy = session.sub;
      updateData.excludeSetAt = now;
    } else if (data.excludeReason !== undefined) {
      // Reason edited without flipping the flag (admin clarifying the
      // existing exclusion note). Update the reason only.
      updateData.excludeReason = data.excludeReason;
    }

    const row = await db.spinSegment.update({ where: { id: idRaw }, data: updateData });

    // Bump tier configVersion if any pool-affecting field actually
    // changed value. Reorder-only edits keep configVersion stable.
    const poolChanged = Object.keys(updateData).some((k) => {
      if (!POOL_AFFECTING_KEYS.has(k)) return false;
      // tierId change can move pool on the OLD and NEW tier; bump both.
      return true;
    });
    if (poolChanged) {
      const tiersToBump = new Set<string>();
      if (existing.tierId) tiersToBump.add(existing.tierId);
      if (row.tierId) tiersToBump.add(row.tierId);
      for (const tid of tiersToBump) {
        await db.spinWheelTier.update({ where: { id: tid }, data: { configVersion: { increment: 1 } } });
      }
    }

    // Audit row. Excluded-flag flips get their own changeType so the
    // history view can filter on it cheaply.
    const tierForVersion = row.tierId ?? existing.tierId;
    const tierRow = tierForVersion
      ? await db.spinWheelTier.findUnique({ where: { id: tierForVersion }, select: { configVersion: true } })
      : null;
    await db.spinSegmentAudit.create({
      data: {
        segmentId: row.id,
        actorId: session.sub,
        actorRole: session.role,
        changeType: excludeChanged
          ? (excludeNext ? 'exclude_on' : 'exclude_off')
          : 'edit',
        reason: excludeChanged ? data.excludeReason ?? null : null,
        before: {
          label: existing.label, weight: existing.weight, payoutType: existing.payoutType,
          payoutAmount: existing.payoutAmount, isActive: existing.isActive,
          excludeFromWins: existing.excludeFromWins, excludeReason: existing.excludeReason,
          tierId: existing.tierId,
        },
        after: {
          label: row.label, weight: row.weight, payoutType: row.payoutType,
          payoutAmount: row.payoutAmount, isActive: row.isActive,
          excludeFromWins: row.excludeFromWins, excludeReason: row.excludeReason,
          tierId: row.tierId,
        },
        configVersion: tierRow?.configVersion ?? null,
      },
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: excludeChanged ? (excludeNext ? 'SPIN_SEGMENT_EXCLUDE_ON' : 'SPIN_SEGMENT_EXCLUDE_OFF') : 'SPIN_SEGMENT_PATCH',
      target: row.id,
      detail: excludeChanged ? data.excludeReason ?? '(no reason supplied)' : undefined,
    });
    return jsonOk({ segment: row });
  });
}

export async function DELETE(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('rewards.write');
    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    if (!id) return jsonError(400, 'VALIDATION', 'id required');
    const existing = await db.spinSegment.findUnique({ where: { id } });
    if (!existing) return jsonError(404, 'SEGMENT_NOT_FOUND');
    // Audit BEFORE delete so the cascade does not wipe the audit row
    // we are about to write. The audit FK has onDelete:Cascade so
    // creating it after delete would error.
    // Snapshot the segment, then delete + bump tier in a transaction.
    await db.$transaction(async (tx) => {
      await tx.spinSegmentAudit.create({
        data: {
          segmentId: existing.id,
          actorId: session.sub,
          actorRole: session.role,
          changeType: 'delete',
          before: {
            label: existing.label, weight: existing.weight, payoutType: existing.payoutType,
            payoutAmount: existing.payoutAmount, isActive: existing.isActive,
            excludeFromWins: existing.excludeFromWins, excludeReason: existing.excludeReason,
            tierId: existing.tierId,
          } as Prisma.InputJsonValue,
          after: Prisma.JsonNull,
        },
      });
      await tx.spinSegment.delete({ where: { id } });
      if (existing.tierId) {
        await tx.spinWheelTier.update({ where: { id: existing.tierId }, data: { configVersion: { increment: 1 } } });
      }
    });
    await recordActivity({ actorId: session.sub, actorRole: session.role, action: 'SPIN_SEGMENT_DELETE', target: id });
    return jsonOk({ deleted: true });
  });
}
