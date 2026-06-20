// Built by Anointed Coder.
//
// ZinIPay (zinipay.com) HTTP client. Deposit-only gateway that renders
// a hosted payment page; player chooses bKash / Nagad / Rocket on
// ZinIPay's screen, not ours. No payout / disbursement endpoint
// documented, so withdrawals still go via ChaopaoPay or manual.
//
// API base: https://api.zinipay.com (per docs, no separate prod host)
// Auth: header `zini-api-key: <api_key>`
// Endpoints:
//   POST /v1/payment/create  -> { status, payment_url }
//   POST /v1/payment/verify  -> { amount, invoice_id, payment_method, transaction_id, status }
// No HMAC signing on either side - the webhook handler MUST re-call
// /v1/payment/verify before crediting anything.

import { db } from '@/lib/db/client';

export interface ZinIPaySettings {
  enabled: boolean;
  baseUrl: string;
  apiKey: string | null;
  brandIcon: string | null;
  createPath: string;
  verifyPath: string;
}

const SETTINGS_KEYS = [
  'payment_zinipay_enabled',
  'payment_zinipay_base_url',
  'payment_zinipay_api_key',
  'payment_zinipay_icon',
  'payment_zinipay_create_path',
  'payment_zinipay_verify_path',
] as const;

export async function readZinIPaySettings(): Promise<ZinIPaySettings> {
  const rows = await db.systemSetting.findMany({
    where: { key: { in: [...SETTINGS_KEYS] } },
  });
  const m = new Map<string, string>();
  for (const r of rows) if (r.value && r.value.trim()) m.set(r.key, r.value.trim());
  return {
    enabled: (m.get('payment_zinipay_enabled') ?? '0') === '1',
    baseUrl: m.get('payment_zinipay_base_url') ?? 'https://api.zinipay.com',
    apiKey: m.get('payment_zinipay_api_key') ?? null,
    brandIcon: m.get('payment_zinipay_icon') ?? null,
    createPath: m.get('payment_zinipay_create_path') ?? '/v1/payment/create',
    verifyPath: m.get('payment_zinipay_verify_path') ?? '/v1/payment/verify',
  };
}

function normPath(p: string): string {
  return p.startsWith('/') ? p : `/${p}`;
}

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}${normPath(path)}`;
}

function authHeaders(cfg: ZinIPaySettings): Record<string, string> {
  if (!cfg.apiKey) throw new Error('ZINIPAY_NOT_CONFIGURED');
  return {
    'Content-Type': 'application/json',
    'zini-api-key': cfg.apiKey,
  };
}

export interface ZinIPayCreateInput {
  amount: number;
  redirectUrl: string;
  cancelUrl?: string;
  webhookUrl?: string;
  customerName?: string;
  customerEmail?: string;
  metadata?: Record<string, unknown>;
}

export interface ZinIPayCreateResult {
  ok: true;
  paymentUrl: string;
  raw: unknown;
}
export interface ZinIPayCreateFailure {
  ok: false;
  error: string;
  raw?: unknown;
}

// Server-side create. Returns paymentUrl to redirect the player to.
export async function zinipayCreate(
  input: ZinIPayCreateInput,
): Promise<ZinIPayCreateResult | ZinIPayCreateFailure> {
  const cfg = await readZinIPaySettings();
  if (!cfg.enabled) return { ok: false, error: 'ZINIPAY_DISABLED' };
  if (!cfg.apiKey) return { ok: false, error: 'ZINIPAY_NOT_CONFIGURED' };

  const url = joinUrl(cfg.baseUrl, cfg.createPath);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: authHeaders(cfg),
      body: JSON.stringify({
        amount: input.amount,
        redirect_url: input.redirectUrl,
        cancel_url: input.cancelUrl,
        webhook_url: input.webhookUrl,
        cus_name: input.customerName,
        cus_email: input.customerEmail,
        metadata: input.metadata ?? {},
      }),
    });
  } catch (err) {
    return { ok: false, error: `ZINIPAY_FETCH_FAILED:${err instanceof Error ? err.message : String(err)}` };
  }

  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    return { ok: false, error: `ZINIPAY_HTTP_${res.status}`, raw: body };
  }
  const b = (body ?? {}) as { status?: unknown; payment_url?: unknown; message?: unknown };
  const ok = b.status === true || b.status === 'true' || b.status === 1;
  const paymentUrl = typeof b.payment_url === 'string' ? b.payment_url : '';
  if (!ok || !paymentUrl) {
    return { ok: false, error: `ZINIPAY_CREATE_REJECTED:${typeof b.message === 'string' ? b.message : 'unknown'}`, raw: body };
  }
  return { ok: true, paymentUrl, raw: body };
}

export type ZinIPayStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'UNKNOWN';

export interface ZinIPayVerifyResult {
  ok: true;
  invoiceId: string;
  amount: number;
  status: ZinIPayStatus;
  paymentMethod: string | null;
  transactionId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  raw: unknown;
}
export interface ZinIPayVerifyFailure {
  ok: false;
  error: string;
  raw?: unknown;
}

export async function zinipayVerify(
  invoiceId: string,
): Promise<ZinIPayVerifyResult | ZinIPayVerifyFailure> {
  const cfg = await readZinIPaySettings();
  if (!cfg.apiKey) return { ok: false, error: 'ZINIPAY_NOT_CONFIGURED' };

  const url = joinUrl(cfg.baseUrl, cfg.verifyPath);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: authHeaders(cfg),
      body: JSON.stringify({ invoice_id: invoiceId }),
    });
  } catch (err) {
    return { ok: false, error: `ZINIPAY_FETCH_FAILED:${err instanceof Error ? err.message : String(err)}` };
  }

  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    return { ok: false, error: `ZINIPAY_VERIFY_HTTP_${res.status}`, raw: body };
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const statusRaw = typeof b.status === 'string' ? b.status.toUpperCase() : '';
  const status: ZinIPayStatus =
    statusRaw === 'COMPLETED' || statusRaw === 'PENDING' || statusRaw === 'FAILED'
      ? (statusRaw as ZinIPayStatus)
      : 'UNKNOWN';
  return {
    ok: true,
    invoiceId: typeof b.invoice_id === 'string' ? b.invoice_id : invoiceId,
    amount: Number(b.amount ?? 0) || 0,
    status,
    paymentMethod: typeof b.payment_method === 'string' ? b.payment_method : null,
    transactionId: typeof b.transaction_id === 'string' ? b.transaction_id : null,
    customerName: typeof b.cus_name === 'string' ? b.cus_name : null,
    customerEmail: typeof b.cus_email === 'string' ? b.cus_email : null,
    raw: body,
  };
}
