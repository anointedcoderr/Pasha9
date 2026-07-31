// Built by Anointed Coder.
//
// StarPay (stp1.starpay1.com) HTTP client. Hosted-payment / QR deposit
// gateway for Bangladesh (bKash / Nagad / Rocket). Built from the
// provider's StarPay API Integration Handoff (merchant id 25, account
// pasha9). Deposits: create an order, redirect the player to payUrl, and
// credit on the async notify callback. Payouts (withdrawals) are NOT
// implemented here yet because the provider has not supplied the payout
// create-order request spec.
//
// Auth / signing (per the handoff, section 4):
//   - sort the request params by key, ascending lexical order
//   - drop the `sign` field and any null / "null" / empty / blank value
//   - join as key=value pairs with &
//   - append &secretKey=<merchant secret>
//   - MD5 the UTF-8 bytes, hex, UPPERCASE
// One provider sample uppercases the secret before hashing while the
// others use it as supplied, so the case is a configurable toggle that
// MUST be confirmed against a sandbox order before go-live.
//
// The merchant secret is NEVER hardcoded here. It is read from a
// SystemSetting row set only in admin, and is never returned to the
// browser or written to logs.

import { createHash } from 'crypto';
import { db } from '@/lib/db/client';

export interface StarPaySettings {
  enabled: boolean;
  baseUrl: string;
  mchId: string | null;
  secret: string | null;
  uppercaseSecret: boolean;
  createPath: string;
  queryPath: string;
  // Deposit channel (productId) per method, from the handoff section 2.
  channelCombined: string;
  channelBkash: string;
  channelNagad: string;
  channelRocket: string;
  brandIcon: string | null;
}

const SETTINGS_KEYS = [
  'payment_starpay_enabled',
  'payment_starpay_base_url',
  'payment_starpay_mch_id',
  'payment_starpay_secret',
  'payment_starpay_uppercase_secret',
  'payment_starpay_create_path',
  'payment_starpay_query_path',
  'payment_starpay_channel_combined',
  'payment_starpay_channel_bkash',
  'payment_starpay_channel_nagad',
  'payment_starpay_channel_rocket',
  'payment_starpay_icon',
] as const;

export async function readStarPaySettings(): Promise<StarPaySettings> {
  const rows = await db.systemSetting.findMany({ where: { key: { in: [...SETTINGS_KEYS] } } });
  const m = new Map<string, string>();
  for (const r of rows) if (r.value && r.value.trim()) m.set(r.key, r.value.trim());
  return {
    enabled: (m.get('payment_starpay_enabled') ?? '0') === '1',
    baseUrl: m.get('payment_starpay_base_url') ?? 'https://stp1api.starpay1.com',
    mchId: m.get('payment_starpay_mch_id') ?? null,
    secret: m.get('payment_starpay_secret') ?? null,
    uppercaseSecret: (m.get('payment_starpay_uppercase_secret') ?? '0') === '1',
    createPath: m.get('payment_starpay_create_path') ?? '/v1.0/api/order/create',
    queryPath: m.get('payment_starpay_query_path') ?? '/v1.0/api/order/query',
    channelCombined: m.get('payment_starpay_channel_combined') ?? '5307',
    channelBkash: m.get('payment_starpay_channel_bkash') ?? '5301',
    channelNagad: m.get('payment_starpay_channel_nagad') ?? '5302',
    channelRocket: m.get('payment_starpay_channel_rocket') ?? '5303',
    brandIcon: m.get('payment_starpay_icon') ?? null,
  };
}

/** Deposit method -> StarPay productId (channel), using the operator config. */
export function starpayDepositChannel(cfg: StarPaySettings, method: string): string {
  switch (method.toLowerCase()) {
    case 'bkash': return cfg.channelBkash;
    case 'nagad': return cfg.channelNagad;
    case 'rocket': return cfg.channelRocket;
    default: return cfg.channelCombined;
  }
}

function normPath(p: string): string {
  return p.startsWith('/') ? p : `/${p}`;
}
function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}${normPath(path)}`;
}

/**
 * Build the StarPay MD5 signature over a set of request/callback params.
 * Exported so verifyWebhook can rebuild and compare the callback's sign.
 */
export function starpaySign(params: Record<string, unknown>, secret: string, uppercaseSecret: boolean): string {
  const keys = Object.keys(params)
    .filter((k) => k !== 'sign')
    .filter((k) => {
      const v = params[k];
      if (v === null || v === undefined) return false;
      const s = String(v).trim();
      return s !== '' && s.toLowerCase() !== 'null';
    })
    .sort();
  const canonical = keys.map((k) => `${k}=${params[k]}`).join('&');
  const secretForHash = uppercaseSecret ? secret.toUpperCase() : secret;
  return createHash('md5').update(`${canonical}&secretKey=${secretForHash}`, 'utf8').digest('hex').toUpperCase();
}

/** Constant-time-ish compare of two uppercase hex signatures. */
export function starpaySignMatches(received: unknown, expected: string): boolean {
  if (typeof received !== 'string' || received.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= received.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

// StarPay order status ints (handoff section 7). 1 = success; 3/5/7/9/11
// are refund/reject/chargeback/creation-failed => failed; 0/10 => pending.
export function starpayMapStatus(status: unknown): 'success' | 'failed' | 'pending' {
  const n = Number(status);
  if (n === 1) return 'success';
  if ([3, 5, 7, 9, 11].includes(n)) return 'failed';
  return 'pending';
}

export interface StarPayCreateInput {
  mchOrderNo: string;
  amountBdt: number;   // major BDT units; converted to minor for the API
  productId: string;   // channel id
  clientIp: string;
  notifyUrl: string;
  returnUrl?: string;
  subject?: string;
  body?: string;
}
export interface StarPayCreateResult {
  ok: true;
  payUrl: string;
  payOrderId: string | null;
  raw: unknown;
}
export interface StarPayCreateFailure {
  ok: false;
  error: string;
  raw?: unknown;
}

export async function starpayCreateOrder(
  input: StarPayCreateInput,
): Promise<StarPayCreateResult | StarPayCreateFailure> {
  const cfg = await readStarPaySettings();
  if (!cfg.enabled) return { ok: false, error: 'STARPAY_DISABLED' };
  if (!cfg.mchId || !cfg.secret) return { ok: false, error: 'STARPAY_NOT_CONFIGURED' };

  // Amount is in MINOR units (paisa) per the handoff, no decimals.
  const amountMinor = Math.round(input.amountBdt * 100);
  const params: Record<string, unknown> = {
    mchId: cfg.mchId,
    productId: input.productId,
    mchOrderNo: input.mchOrderNo,
    amount: amountMinor,
    clientIp: input.clientIp || '0.0.0.0',
    notifyUrl: input.notifyUrl,
  };
  if (input.returnUrl) params.returnUrl = input.returnUrl;
  if (input.subject) params.subject = input.subject;
  if (input.body) params.body = input.body;
  const sign = starpaySign(params, cfg.secret, cfg.uppercaseSecret);

  const url = joinUrl(cfg.baseUrl, cfg.createPath);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...params, sign }),
    });
  } catch (err) {
    return { ok: false, error: `STARPAY_FETCH_FAILED:${err instanceof Error ? err.message : String(err)}` };
  }

  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, error: `STARPAY_HTTP_${res.status}`, raw: body };

  const b = (body ?? {}) as Record<string, unknown>;
  const success = String(b.retCode ?? '').toUpperCase() === 'SUCCESS';
  const payUrl = typeof b.payUrl === 'string' ? b.payUrl : '';
  if (!success || !payUrl) {
    return { ok: false, error: `STARPAY_CREATE_REJECTED:${typeof b.retMsg === 'string' ? b.retMsg : 'unknown'}`, raw: body };
  }
  return { ok: true, payUrl, payOrderId: typeof b.payOrderId === 'string' ? b.payOrderId : null, raw: body };
}

export interface StarPayQueryResult {
  ok: true;
  status: 'success' | 'failed' | 'pending';
  rawStatus: number | null;
  payOrderId: string | null;
  mchOrderNo: string | null;
  amountBdt: number;
  raw: unknown;
}
export interface StarPayQueryFailure {
  ok: false;
  error: string;
  raw?: unknown;
}

/** Query an order by our merchant order number (reconciliation / recheck). */
export async function starpayQueryOrder(
  mchOrderNo: string,
): Promise<StarPayQueryResult | StarPayQueryFailure> {
  const cfg = await readStarPaySettings();
  if (!cfg.mchId || !cfg.secret) return { ok: false, error: 'STARPAY_NOT_CONFIGURED' };

  const params: Record<string, unknown> = { mchId: cfg.mchId, mchOrderNo };
  const sign = starpaySign(params, cfg.secret, cfg.uppercaseSecret);

  const url = joinUrl(cfg.baseUrl, cfg.queryPath);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...params, sign }),
    });
  } catch (err) {
    return { ok: false, error: `STARPAY_FETCH_FAILED:${err instanceof Error ? err.message : String(err)}` };
  }

  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, error: `STARPAY_QUERY_HTTP_${res.status}`, raw: body };

  const b = (body ?? {}) as Record<string, unknown>;
  const rawStatus = b.status == null ? null : Number(b.status);
  const amountMinor = Number(b.realAmount ?? b.amount ?? 0) || 0;
  return {
    ok: true,
    status: starpayMapStatus(rawStatus),
    rawStatus,
    payOrderId: typeof b.payOrderId === 'string' ? b.payOrderId : null,
    mchOrderNo: typeof b.mchOrderNo === 'string' ? b.mchOrderNo : mchOrderNo,
    amountBdt: amountMinor / 100,
    raw: body,
  };
}
