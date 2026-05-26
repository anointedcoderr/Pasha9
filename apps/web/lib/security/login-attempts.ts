// Built by Anointed Coder.
//
// Thin wrapper that writes one LoginAttempt row. Never throws -
// auditing must not break the auth flow.

import { db } from '@/lib/db/client';

export interface RecordAttemptOpts {
  identifier: string;
  userId?: string | null;
  surface: 'user' | 'admin';
  ip?: string | null;
  userAgent?: string | null;
  success: boolean;
  reason: string;
  flags?: string[];
}

export async function recordLoginAttempt(opts: RecordAttemptOpts): Promise<void> {
  try {
    await db.loginAttempt.create({
      data: {
        identifier: opts.identifier.slice(0, 80),
        userId: opts.userId ?? null,
        surface: opts.surface,
        ip: opts.ip ?? null,
        userAgent: (opts.userAgent ?? '').slice(0, 500) || null,
        success: opts.success,
        reason: opts.reason,
        flags: opts.flags && opts.flags.length > 0 ? opts.flags.join(',') : null,
      },
    });
  } catch (err) {
    console.error('[login-attempt] write failed', err);
  }
}
