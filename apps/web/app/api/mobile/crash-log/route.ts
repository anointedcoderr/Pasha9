// Built by Anointed Coder.
//
// Diagnostic-only, temporary. The mobile app's global JS error handler
// (mobile/lib/crash-report.ts) posts here when it catches an uncaught
// exception, since we have no live dev-server connection to a remote test
// device. Unauthenticated by necessity (a crashed app has no session), so
// this is rate-limited per IP and does nothing with the payload beyond
// logging it - no DB write, no PII collection. Logged with the "⨯" marker
// so it surfaces in scripts/error-log.sh, the same diagnostic already used
// for the web app all session.
//
// Remove this route (and the app's crash-report import) once the current
// crash is found and fixed - it is not meant to be permanent.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { jsonOk } from '@/lib/auth/errors';
import { rateLimit } from '@/lib/auth/rate-limit';

const schema = z.object({
  message: z.string().max(2000),
  stack: z.string().max(8000).nullable().optional(),
  isFatal: z.boolean().optional(),
  platform: z.string().max(40).optional(),
  osVersion: z.string().max(40).optional(),
  appVersion: z.string().max(40).nullable().optional(),
  device: z.string().max(120).nullable().optional(),
});

function clientIp(req: NextRequest): string {
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    'unknown'
  );
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const limit = rateLimit(`mobile-crash-log:${ip}`, 20, 60_000);
  if (!limit.ok) return jsonOk({ ok: true });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (parsed.success) {
    const p = parsed.data;
    console.error(
      `⨯ MobileAppCrash: ${p.message} | fatal=${p.isFatal ?? false} platform=${p.platform ?? '?'} os=${p.osVersion ?? '?'} appVersion=${p.appVersion ?? '?'} device=${p.device ?? '?'}\n${p.stack ?? '(no stack)'}`,
    );
  }

  // Always 200 - the app should never retry-storm over a reporting failure.
  return jsonOk({ ok: true });
}
