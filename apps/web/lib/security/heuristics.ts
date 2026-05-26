// Built by Anointed Coder.
//
// M2K suspicious-activity scoring. Tiny rule engine - returns the
// list of flags that apply to the current login attempt. The login
// route uses these to:
//   - persist on LoginAttempt.flags
//   - decide whether to fire an admin SMS alert
//   - feed the admin /admin/security heuristics panel

import { db } from '@/lib/db/client';

export interface ScoreInput {
  userId: string | null;
  surface: 'user' | 'admin';
  ip: string | null;
  userAgent: string | null;
}

export interface ScoreResult {
  flags: string[];
  recentFailCount: number;
  knownIp: boolean;
}

const RECENT_FAIL_WINDOW_MS = 15 * 60 * 1000;
const RECENT_FAIL_THRESHOLD = 3;

export async function scoreLoginContext(input: ScoreInput): Promise<ScoreResult> {
  const flags: string[] = [];
  let recentFailCount = 0;
  let knownIp = true;

  try {
    if (input.userId) {
      // Recent failures for this user.
      const since = new Date(Date.now() - RECENT_FAIL_WINDOW_MS);
      recentFailCount = await db.loginAttempt.count({
        where: { userId: input.userId, success: false, createdAt: { gte: since } },
      });
      if (recentFailCount >= RECENT_FAIL_THRESHOLD) flags.push('multiple_recent_failures');

      // New IP check: has this user EVER logged in successfully from
      // this IP before?
      if (input.ip) {
        const ipHit = await db.loginAttempt.count({
          where: { userId: input.userId, success: true, ip: input.ip },
        });
        if (ipHit === 0) {
          flags.push('new_ip');
          knownIp = false;
        }
      }
    } else if (input.ip) {
      // Anonymous attempt - count failures from this IP.
      const since = new Date(Date.now() - RECENT_FAIL_WINDOW_MS);
      recentFailCount = await db.loginAttempt.count({
        where: { ip: input.ip, success: false, createdAt: { gte: since } },
      });
      if (recentFailCount >= RECENT_FAIL_THRESHOLD) flags.push('ip_repeated_failures');
    }

    if (input.surface === 'admin') flags.push('admin_surface');
  } catch (err) {
    console.error('[heuristics] scoring failed', err);
  }

  return { flags, recentFailCount, knownIp };
}
