// Built by Anointed Coder.
//
// M2K IP block list. Supports both single IPs and CIDR ranges
// (/8.../32). Used by the middleware on every request to /admin/* +
// /api/admin/* + /api/auth/* and also by the login routes as a
// belt-and-braces check.
//
// Cache: rules are loaded into memory and refreshed every 60s.
// Edits via the admin page bust the cache immediately via
// invalidateIpBlockCache(). Live updates therefore land within one
// tick.

import { db } from '@/lib/db/client';

const TTL_MS = 60 * 1000;

interface CompiledRule {
  raw: string;
  base: bigint;
  mask: bigint;
  expiresAt: Date | null;
}

let cache: { loadedAt: number; rules: CompiledRule[] } | null = null;
let inflight: Promise<CompiledRule[]> | null = null;

function ipToBigInt(ip: string): bigint | null {
  // IPv4 only for now. IPv6 left for a follow-up; admins on shared
  // mobile carriers in BD almost always present as IPv4.
  const parts = ip.trim().split('.');
  if (parts.length !== 4) return null;
  let acc = 0n;
  for (const p of parts) {
    const n = Number(p);
    if (!Number.isFinite(n) || n < 0 || n > 255) return null;
    acc = (acc << 8n) | BigInt(n);
  }
  return acc;
}

function parseRule(raw: string): { base: bigint; mask: bigint } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const [ipPart, prefixPart] = trimmed.split('/');
  const baseRaw = ipToBigInt(ipPart);
  if (baseRaw === null) return null;
  const prefix = prefixPart !== undefined ? Number(prefixPart) : 32;
  if (!Number.isFinite(prefix) || prefix < 0 || prefix > 32) return null;
  const mask = prefix === 0 ? 0n : ((1n << BigInt(prefix)) - 1n) << BigInt(32 - prefix);
  const base = baseRaw & mask;
  return { base, mask };
}

async function loadRules(): Promise<CompiledRule[]> {
  const now = new Date();
  const rows = await db.ipBlockRule.findMany({
    where: { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    select: { ip: true, expiresAt: true },
  });
  const compiled: CompiledRule[] = [];
  for (const r of rows) {
    const parsed = parseRule(r.ip);
    if (!parsed) continue;
    compiled.push({ raw: r.ip, base: parsed.base, mask: parsed.mask, expiresAt: r.expiresAt });
  }
  return compiled;
}

async function getRules(): Promise<CompiledRule[]> {
  if (cache && Date.now() - cache.loadedAt < TTL_MS) return cache.rules;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const rules = await loadRules();
      cache = { loadedAt: Date.now(), rules };
      return rules;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function invalidateIpBlockCache(): void {
  cache = null;
}

export async function isIpBlocked(ip: string | null | undefined): Promise<{ blocked: boolean; rule: string | null }> {
  if (!ip) return { blocked: false, rule: null };
  const candidate = ipToBigInt(ip);
  if (candidate === null) return { blocked: false, rule: null };
  const rules = await getRules();
  for (const r of rules) {
    if ((candidate & r.mask) === r.base) {
      return { blocked: true, rule: r.raw };
    }
  }
  return { blocked: false, rule: null };
}

// Synchronous helper for the middleware which cannot await DB calls
// reliably (it runs in the Edge runtime). It checks the cached
// snapshot; if cache is cold the middleware proceeds and the route
// handler does a fresh check.
export function isIpBlockedCached(ip: string | null | undefined): { blocked: boolean; rule: string | null } {
  if (!ip || !cache) return { blocked: false, rule: null };
  const candidate = ipToBigInt(ip);
  if (candidate === null) return { blocked: false, rule: null };
  for (const r of cache.rules) {
    if ((candidate & r.mask) === r.base) {
      return { blocked: true, rule: r.raw };
    }
  }
  return { blocked: false, rule: null };
}
