// Built by Anointed Coder.
//
// GET /api/admin/audit - two-way accountability search.
//
//   ?mode=user&q=<username|user id|phone>   every staff action affecting that
//                                           player, plus every money movement
//   ?mode=staff&q=<username|user id>        every player that staff member
//                                           touched and what they changed
//   ?mode=anomalies                         platform-wide balance vs records sweep
//
// Both directions read the SAME three permanent tables, so the two views can
// never disagree:
//
//   WalletLedger  - money. Carries balanceBefore/After and, for manual
//                   actions, the actor who caused it.
//   TurnoverEvent - wagering requirement. Carries turnoverBefore/After, actor
//                   and reason for manual adjustments.
//   ActivityLog   - everything else a staff member did: approvals, rejections,
//                   settings changes, anything recorded via recordActivity.
//
// Nothing here writes. These records are append-only by design: corrections
// are written as opposing entries rather than edits, and no route in the
// application updates or deletes a row in any of the three tables.
//
// Default window is the last 24 hours, per the client's requirement, with
// from/to overriding it for older periods.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';
import { findWalletAnomalies } from '@/lib/wallet/reconcile';

const MAX_ROWS = 500;

function windowFrom(req: NextRequest): { from: Date; to: Date } {
  const fromRaw = req.nextUrl.searchParams.get('from');
  const toRaw = req.nextUrl.searchParams.get('to');
  const to = toRaw ? new Date(toRaw) : new Date();
  // Default 24 hours. An unparseable date falls back rather than throwing,
  // because a bad querystring should not blank an audit screen.
  const from = fromRaw && !Number.isNaN(Date.parse(fromRaw))
    ? new Date(fromRaw)
    : new Date(to.getTime() - 24 * 60 * 60 * 1000);
  return { from, to: Number.isNaN(to.getTime()) ? new Date() : to };
}

/** Resolve a free-text query to one user by username, id or phone. */
async function resolveUser(q: string) {
  const term = q.trim();
  if (!term) return null;
  return db.user.findFirst({
    where: {
      OR: [
        { username: { equals: term, mode: 'insensitive' } },
        { id: term },
        { phone: { contains: term } },
        { username: { contains: term, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      username: true,
      phone: true,
      status: true,
      role: { select: { key: true, label: true } },
      wallet: { select: { balance: true, bonusBalance: true, lockedBalance: true } },
    },
  });
}

/** Actor names for a set of ids, so the UI can show who rather than an id. */
async function actorMap(ids: Array<string | null>) {
  const unique = [...new Set(ids.filter((v): v is string => Boolean(v)))];
  if (unique.length === 0) return new Map<string, { username: string; role: string | null }>();
  const rows = await db.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, username: true, role: { select: { label: true } } },
  });
  return new Map(rows.map((r) => [r.id, { username: r.username, role: r.role?.label ?? null }]));
}

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    // Reading who did what to whom is a supervisory power, so it sits behind
    // its own permission rather than any general admin access.
    await ensurePermission('menu.audit.view');

    const mode = req.nextUrl.searchParams.get('mode') ?? 'user';
    const q = req.nextUrl.searchParams.get('q') ?? '';
    const { from, to } = windowFrom(req);
    const range = { gte: from, lte: to };

    if (mode === 'anomalies') {
      return jsonOk({ mode, anomalies: await findWalletAnomalies(MAX_ROWS) });
    }

    if (!q.trim()) return jsonOk({ mode, from, to, subject: null, rows: [] });

    const subject = await resolveUser(q);
    if (!subject) return jsonError(404, 'NOT_FOUND', 'No user matches that username, id or phone.');

    if (mode === 'staff') {
      // What this staff member did, to anyone.
      const [logs, ledger, turnover] = await Promise.all([
        db.activityLog.findMany({
          where: { actorId: subject.id, createdAt: range },
          orderBy: { createdAt: 'desc' },
          take: MAX_ROWS,
          select: { id: true, action: true, target: true, detail: true, createdAt: true, meta: true },
        }),
        db.walletLedger.findMany({
          where: { actorId: subject.id, createdAt: range },
          orderBy: { createdAt: 'desc' },
          take: MAX_ROWS,
          select: {
            id: true, userId: true, type: true, amount: true, balanceBefore: true, balanceAfter: true,
            description: true, createdAt: true,
          },
        }),
        db.turnoverEvent.findMany({
          where: { actorId: subject.id, createdAt: range },
          orderBy: { createdAt: 'desc' },
          take: MAX_ROWS,
          select: {
            id: true, userId: true, kind: true, amount: true, turnoverBefore: true, turnoverAfter: true,
            reason: true, createdAt: true,
          },
        }),
      ]);

      // Affected players, named, so the operator reads usernames not ids.
      const affected = await actorMap([
        ...ledger.map((r) => r.userId),
        ...turnover.map((r) => r.userId),
        ...logs.map((r) => r.target),
      ]);

      const rows = [
        ...ledger.map((r) => ({
          at: r.createdAt, source: 'money' as const, id: r.id,
          subjectId: r.userId, subjectName: affected.get(r.userId)?.username ?? r.userId,
          action: r.type, detail: r.description,
          balanceBefore: r.balanceBefore.toString(), change: r.amount.toString(), balanceAfter: r.balanceAfter.toString(),
          turnoverBefore: null, turnoverAfter: null, reason: null,
        })),
        ...turnover.map((r) => ({
          at: r.createdAt, source: 'turnover' as const, id: r.id,
          subjectId: r.userId, subjectName: affected.get(r.userId)?.username ?? r.userId,
          action: `turnover.${r.kind}`, detail: null,
          balanceBefore: null, change: r.amount.toString(), balanceAfter: null,
          turnoverBefore: r.turnoverBefore?.toString() ?? null, turnoverAfter: r.turnoverAfter?.toString() ?? null,
          reason: r.reason,
        })),
        ...logs.map((r) => ({
          at: r.createdAt, source: 'action' as const, id: r.id,
          subjectId: r.target, subjectName: r.target ? (affected.get(r.target)?.username ?? r.target) : null,
          action: r.action, detail: r.detail,
          balanceBefore: null, change: null, balanceAfter: null,
          turnoverBefore: null, turnoverAfter: null, reason: null,
        })),
      ].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, MAX_ROWS);

      return jsonOk({ mode, from, to, subject: { ...subject, wallet: undefined }, rows });
    }

    // mode=user: everything that happened TO this player, and who did it.
    const [ledger, turnover, logs] = await Promise.all([
      db.walletLedger.findMany({
        where: { userId: subject.id, createdAt: range },
        orderBy: { createdAt: 'desc' },
        take: MAX_ROWS,
        select: {
          // No `reason` column here by design: a movement's why lives in
          // `description`. Only TurnoverEvent carries a separate reason.
          id: true, type: true, amount: true, balanceBefore: true, balanceAfter: true, status: true,
          description: true, actorId: true, actorRole: true, createdAt: true,
          transactionId: true, providerTransactionId: true, gameName: true, referenceId: true,
        },
      }),
      db.turnoverEvent.findMany({
        where: { userId: subject.id, createdAt: range },
        orderBy: { createdAt: 'desc' },
        take: MAX_ROWS,
        select: {
          id: true, kind: true, amount: true, turnoverBefore: true, turnoverAfter: true,
          reason: true, actorId: true, actorRole: true, createdAt: true,
        },
      }),
      db.activityLog.findMany({
        where: { target: subject.id, createdAt: range },
        orderBy: { createdAt: 'desc' },
        take: MAX_ROWS,
        select: { id: true, action: true, detail: true, actorId: true, actorRole: true, createdAt: true },
      }),
    ]);

    const actors = await actorMap([
      ...ledger.map((r) => r.actorId),
      ...turnover.map((r) => r.actorId),
      ...logs.map((r) => r.actorId),
    ]);
    const named = (id: string | null) => (id ? (actors.get(id)?.username ?? id) : null);

    const rows = [
      ...ledger.map((r) => ({
        at: r.createdAt, source: 'money' as const, id: r.id,
        action: r.type, detail: r.description, status: r.status,
        balanceBefore: r.balanceBefore.toString(), change: r.amount.toString(), balanceAfter: r.balanceAfter.toString(),
        turnoverBefore: null, turnoverAfter: null,
        reason: null,
        actorId: r.actorId, actorName: named(r.actorId), actorRole: r.actorRole,
        reference: r.providerTransactionId ?? r.transactionId ?? r.referenceId ?? null,
        game: r.gameName,
      })),
      ...turnover.map((r) => ({
        at: r.createdAt, source: 'turnover' as const, id: r.id,
        action: `turnover.${r.kind}`, detail: null, status: null,
        balanceBefore: null, change: r.amount.toString(), balanceAfter: null,
        turnoverBefore: r.turnoverBefore?.toString() ?? null, turnoverAfter: r.turnoverAfter?.toString() ?? null,
        reason: r.reason,
        actorId: r.actorId, actorName: named(r.actorId), actorRole: r.actorRole,
        reference: null, game: null,
      })),
      ...logs.map((r) => ({
        at: r.createdAt, source: 'action' as const, id: r.id,
        action: r.action, detail: r.detail, status: null,
        balanceBefore: null, change: null, balanceAfter: null,
        turnoverBefore: null, turnoverAfter: null, reason: null,
        actorId: r.actorId, actorName: named(r.actorId), actorRole: r.actorRole,
        reference: null, game: null,
      })),
    ].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, MAX_ROWS);

    return jsonOk({
      mode,
      from,
      to,
      subject: {
        id: subject.id,
        username: subject.username,
        phone: subject.phone,
        status: subject.status,
        role: subject.role?.label ?? null,
        balance: subject.wallet?.balance?.toString() ?? '0.00',
      },
      rows,
    });
  });
}
