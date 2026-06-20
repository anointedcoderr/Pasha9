// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const createSchema = z.object({
  name: z.string().trim().min(1).max(60),
  type: z.enum(['mobile', 'bank', 'crypto']).default('mobile'),
  status: z.enum(['active', 'hidden', 'paused']).default('active'),
  number: z.string().trim().min(1).max(120),
  instruction: z.string().trim().min(1).max(2000),
  instructionBn: z.string().trim().max(2000).optional().nullable(),
  payoutInstruction: z.string().trim().max(2000).optional().nullable(),
  payoutInstructionBn: z.string().trim().max(2000).optional().nullable(),
  iconUrl: z.string().trim().max(500).optional().nullable(),
  bannerUrl: z.string().trim().max(500).optional().nullable(),
  position: z.coerce.number().int().min(0).max(99).default(0),
  depositEnabled: z.boolean().default(true),
  payoutEnabled: z.boolean().default(false),
  minDeposit: z.coerce.number().min(0).max(10_000_000).optional().nullable(),
  maxDeposit: z.coerce.number().min(0).max(10_000_000).optional().nullable(),
  minWithdrawal: z.coerce.number().min(0).max(10_000_000).optional().nullable(),
  maxWithdrawal: z.coerce.number().min(0).max(10_000_000).optional().nullable(),
  badgeLabelEn: z.string().trim().max(24).optional().nullable(),
  badgeLabelBn: z.string().trim().max(24).optional().nullable(),
  badgeEnabled: z.boolean().default(true),
});

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('settings.write');
    const rows = await db.paymentMethod.findMany({ orderBy: [{ position: 'asc' }, { name: 'asc' }] });
    return jsonOk({ methods: rows.map(serialize) });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('settings.write');
    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const method = await db.paymentMethod.create({ data: parsed.data });
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'PAYMENT_METHOD_CREATE',
      target: method.id,
      detail: method.name,
    });
    return jsonOk({ method: serialize(method) }, 201);
  });
}

function serialize(m: {
  id: string;
  name: string;
  type: string;
  status: string;
  number: string;
  instruction: string;
  instructionBn?: string | null;
  payoutInstruction: string | null;
  payoutInstructionBn?: string | null;
  iconUrl?: string | null;
  bannerUrl?: string | null;
  position: number;
  depositEnabled: boolean;
  payoutEnabled: boolean;
  minDeposit: unknown;
  maxDeposit: unknown;
  minWithdrawal: unknown;
  maxWithdrawal: unknown;
  badgeLabelEn?: string | null;
  badgeLabelBn?: string | null;
  badgeEnabled?: boolean;
}) {
  return {
    id: m.id,
    name: m.name,
    type: m.type,
    status: m.status,
    number: m.number,
    instruction: m.instruction,
    instructionBn: m.instructionBn ?? null,
    payoutInstruction: m.payoutInstruction,
    payoutInstructionBn: m.payoutInstructionBn ?? null,
    iconUrl: m.iconUrl ?? null,
    bannerUrl: m.bannerUrl ?? null,
    position: m.position,
    depositEnabled: m.depositEnabled,
    payoutEnabled: m.payoutEnabled,
    minDeposit: m.minDeposit == null ? null : Number(m.minDeposit),
    maxDeposit: m.maxDeposit == null ? null : Number(m.maxDeposit),
    minWithdrawal: m.minWithdrawal == null ? null : Number(m.minWithdrawal),
    maxWithdrawal: m.maxWithdrawal == null ? null : Number(m.maxWithdrawal),
    badgeLabelEn: m.badgeLabelEn ?? null,
    badgeLabelBn: m.badgeLabelBn ?? null,
    badgeEnabled: m.badgeEnabled ?? true,
  };
}
