// Built by Anointed Coder.
// Lightweight in-memory rate limiter. Adequate for single-process PM2 deployments.
// Replaces with a Redis-backed limiter when the platform scales to multiple instances.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

export function rateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: max - 1, resetAt };
  }

  existing.count += 1;
  const ok = existing.count <= max;
  return { ok, remaining: Math.max(0, max - existing.count), resetAt: existing.resetAt };
}

// Periodic cleanup so the map does not grow without bound.
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(k);
    }
  }, 60_000).unref?.();
}
