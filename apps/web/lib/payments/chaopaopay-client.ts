// Built by Anointed Coder.
//
// HTTP client for the ChaopaoPay BD aggregator (bd-api.chaopaopay.cc).
// Auth is X-API-Key + X-Merchant-ID headers, request body is JSON,
// currency is fixed BDT, and the only payment-method-routing knob is
// method_code: 101 = bKash, 102 = Nagad.
//
// The adapter that handles webhook verification lives next door in
// chaopaopay.ts; this file is the OUTBOUND client only (create deposit,
// check status, create payout).

import { db } from '@/lib/db/client';

export const CHAOPAOPAY_METHOD_CODE = {
  bkash: 101,
  nagad: 102,
} as const;
export type ChaopaoPayMethod = keyof typeof CHAOPAOPAY_METHOD_CODE;

interface ChaopaoPaySettings {
  enabled: boolean;
  baseUrl: string;
  merchantId: string | null;
  apiKey: string | null;
  secretKey: string | null;
  withdrawPassword: string | null;
}

async function readSettings(): Promise<ChaopaoPaySettings> {
  const rows = await db.systemSetting.findMany({
    where: {
      key: {
        in: [
          'payment_chaopaopay_enabled',
          'payment_chaopaopay_base_url',
          'payment_chaopaopay_merchant_id',
          'payment_chaopaopay_api_key',
          'payment_chaopaopay_secret_key',
          'payment_chaopaopay_withdraw_password',
        ],
      },
    },
  });
  const m = new Map<string, string>();
  for (const r of rows) if (r.value && r.value.trim()) m.set(r.key, r.value.trim());
  return {
    enabled: (m.get('payment_chaopaopay_enabled') ?? '0') === '1',
    baseUrl: (m.get('payment_chaopaopay_base_url') ?? 'https://bd-api.chaopaopay.cc/api/v1').replace(/\/+$/, ''),
    merchantId: m.get('payment_chaopaopay_merchant_id') ?? null,
    apiKey: m.get('payment_chaopaopay_api_key') ?? null,
    secretKey: m.get('payment_chaopaopay_secret_key') ?? null,
    withdrawPassword: m.get('payment_chaopaopay_withdraw_password') ?? null,
  };
}

export async function loadChaopaoPaySettings(): Promise<ChaopaoPaySettings> {
  return readSettings();
}

function buildAuthHeaders(settings: ChaopaoPaySettings): Record<string, string> {
  if (!settings.apiKey || !settings.merchantId) {
    throw new Error('CHAOPAOPAY_CREDENTIALS_MISSING');
  }
  return {
    'X-API-Key': settings.apiKey,
    'X-Merchant-ID': settings.merchantId,
    'Content-Type': 'application/json',
  };
}

export interface CreatePayInInput {
  trxId: string;
  amount: number;
  method: ChaopaoPayMethod;
  customerName: string;
  callbackUrl: string;
  returnUrl?: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  description?: string | null;
}

export interface CreatePayInResult {
  transactionId: string;
  trxId: string;
  amount: number;
  currency: string;
  status: string;
  paymentUrl: string;
  expiresAt: string | null;
  raw: unknown;
}

/**
 * Create a new deposit request. ChaopaoPay returns a `payment_url`
 * that the player has to be redirected to in order to finish
 * paying with their bKash/Nagad app. The webhook arrives separately
 * once the player completes the payment.
 */
export async function createChaopaoPayIn(input: CreatePayInInput): Promise<CreatePayInResult> {
  const settings = await readSettings();
  if (!settings.enabled) throw new Error('CHAOPAOPAY_DISABLED');
  const headers = buildAuthHeaders(settings);

  const body = {
    trx_id: input.trxId,
    amount: Number(input.amount.toFixed(2)),
    method_code: CHAOPAOPAY_METHOD_CODE[input.method],
    customer_name: input.customerName.slice(0, 80),
    callback_url: input.callbackUrl,
    notify_url: input.callbackUrl, // ChaopaoPay docs treat this as an alias
    ...(input.returnUrl ? { return_url: input.returnUrl } : {}),
    ...(input.customerEmail ? { customer_email: input.customerEmail } : {}),
    ...(input.customerPhone ? { customer_phone: input.customerPhone } : {}),
    ...(input.customerAddress ? { customer_address: input.customerAddress.slice(0, 200) } : {}),
    ...(input.description ? { description: input.description.slice(0, 200) } : {}),
  };

  const url = `${settings.baseUrl}/payin/create.php`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    // 12s caps any single ChaopaoPay round-trip so a slow gateway
    // does not block our deposit endpoint.
    signal: AbortSignal.timeout(12_000),
  });

  const json = await res.json().catch(() => null) as { success?: boolean; message?: string; data?: Record<string, unknown> } | null;
  if (!res.ok || !json || json.success !== true || !json.data) {
    const msg = json?.message ?? `Gateway responded ${res.status}`;
    throw new Error(`CHAOPAOPAY_PAYIN_FAILED:${msg}`);
  }

  const data = json.data;
  const paymentUrl = typeof data.payment_url === 'string' ? data.payment_url : '';
  const transactionId = typeof data.transaction_id === 'string' ? data.transaction_id : '';
  if (!paymentUrl || !transactionId) {
    throw new Error('CHAOPAOPAY_PAYIN_INVALID_RESPONSE');
  }
  return {
    transactionId,
    trxId: typeof data.trx_id === 'string' ? data.trx_id : input.trxId,
    amount: Number(data.amount ?? input.amount),
    currency: typeof data.currency === 'string' ? data.currency : 'BDT',
    status: typeof data.status === 'string' ? data.status : 'pending',
    paymentUrl,
    expiresAt: typeof data.expires_at === 'string' ? data.expires_at : null,
    raw: json,
  };
}

export interface CheckStatusInput {
  transactionId?: string;
  trxId?: string;
}

export interface CheckStatusResult {
  transactionId: string;
  trxId: string;
  type: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'refunded';
  customerName: string | null;
  createdAt: string | null;
  completedAt: string | null;
  raw: unknown;
}

/**
 * Look up the current status of a transaction by either the
 * ChaopaoPay-side transaction_id OR the trx_id we sent. Either field
 * is enough - we pass whichever we have.
 */
export async function checkChaopaoPayStatus(input: CheckStatusInput): Promise<CheckStatusResult> {
  if (!input.transactionId && !input.trxId) {
    throw new Error('CHAOPAOPAY_STATUS_MISSING_ID');
  }
  const settings = await readSettings();
  if (!settings.enabled) throw new Error('CHAOPAOPAY_DISABLED');
  const headers = buildAuthHeaders(settings);

  const body: Record<string, string> = {};
  if (input.transactionId) body.transaction_id = input.transactionId;
  else if (input.trxId) body.trx_id = input.trxId;

  const res = await fetch(`${settings.baseUrl}/transaction/status.php`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const json = await res.json().catch(() => null) as { success?: boolean; message?: string; data?: Record<string, unknown> } | null;
  if (!res.ok || !json || json.success !== true || !json.data) {
    const msg = json?.message ?? `Gateway responded ${res.status}`;
    throw new Error(`CHAOPAOPAY_STATUS_FAILED:${msg}`);
  }
  const data = json.data;
  const status = (typeof data.status === 'string' ? data.status : 'pending') as CheckStatusResult['status'];
  return {
    transactionId: typeof data.transaction_id === 'string' ? data.transaction_id : '',
    trxId: typeof data.trx_id === 'string' ? data.trx_id : (input.trxId ?? ''),
    type: typeof data.type === 'string' ? data.type : 'payin',
    amount: Number(data.amount ?? 0),
    currency: typeof data.currency === 'string' ? data.currency : 'BDT',
    status,
    customerName: typeof data.customer_name === 'string' ? data.customer_name : null,
    createdAt: typeof data.created_at === 'string' ? data.created_at : null,
    completedAt: typeof data.completed_at === 'string' ? data.completed_at : null,
    raw: json,
  };
}

/**
 * Map ChaopaoPay's six status strings down to the three the
 * platform-wide service layer cares about: success / failed /
 * pending. Refunded is treated as failed because the funds left the
 * platform; cancelled likewise.
 */
export function mapChaopaoPayStatus(raw: string): 'success' | 'failed' | 'pending' {
  const s = raw.toLowerCase().trim();
  if (s === 'completed') return 'success';
  if (s === 'failed' || s === 'cancelled' || s === 'refunded') return 'failed';
  return 'pending'; // 'pending' and 'processing'
}

/**
 * Map ChaopaoPay's status strings to the payout-side ('paid' | 'failed'
 * | 'pending') the platform's payout service uses. Same mapping as
 * the deposit side, with 'completed' -> 'paid' instead of 'success'.
 */
export function mapChaopaoPayPayoutStatus(raw: string): 'paid' | 'failed' | 'pending' {
  const s = raw.toLowerCase().trim();
  if (s === 'completed') return 'paid';
  if (s === 'failed' || s === 'cancelled' || s === 'refunded') return 'failed';
  return 'pending';
}

export interface CreatePayOutInput {
  trxId: string;
  amount: number;
  method: ChaopaoPayMethod;
  accountNumber: string;
  accountName: string;
  notifyUrl: string;
  bankName?: string | null;
  branchName?: string | null;
  routingNumber?: string | null;
  description?: string | null;
}

export interface CreatePayOutResult {
  transactionId: string;
  trxId: string;
  amount: number;
  fee: number;
  netAmount: number;
  currency: string;
  status: string;
  methodCode: number;
  accountNumber: string;
  createdAt: string | null;
  raw: unknown;
}

/**
 * Send a payout to a player's bKash / Nagad account. Requires the
 * withdraw password configured under
 * payment_chaopaopay_withdraw_password - ChaopaoPay rejects with
 * INVALID_WITHDRAW_PASS otherwise. The fee is computed by the
 * gateway (returned in the response); we surface it on the
 * Withdrawal row so the operator can reconcile margins.
 */
export async function createChaopaoPayOut(input: CreatePayOutInput): Promise<CreatePayOutResult> {
  const settings = await readSettings();
  if (!settings.enabled) throw new Error('CHAOPAOPAY_DISABLED');
  if (!settings.withdrawPassword) throw new Error('CHAOPAOPAY_WITHDRAW_PASSWORD_MISSING');
  const headers = buildAuthHeaders(settings);

  const body = {
    trx_id: input.trxId,
    amount: Number(input.amount.toFixed(2)),
    method_code: CHAOPAOPAY_METHOD_CODE[input.method],
    account_number: input.accountNumber.trim(),
    account_name: input.accountName.trim().slice(0, 80),
    notify_url: input.notifyUrl,
    withdraw_password: settings.withdrawPassword,
    ...(input.bankName ? { bank_name: input.bankName } : {}),
    ...(input.branchName ? { branch_name: input.branchName } : {}),
    ...(input.routingNumber ? { routing_number: input.routingNumber } : {}),
    ...(input.description ? { description: input.description.slice(0, 200) } : {}),
  };

  const url = `${settings.baseUrl}/payout/create.php`;
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const json = await res.json().catch(() => null) as { success?: boolean; message?: string; data?: Record<string, unknown> } | null;
  if (!res.ok || !json || json.success !== true || !json.data) {
    const msg = json?.message ?? `Gateway responded ${res.status}`;
    throw new Error(`CHAOPAOPAY_PAYOUT_FAILED:${msg}`);
  }
  const data = json.data;
  return {
    transactionId: typeof data.transaction_id === 'string' ? data.transaction_id : '',
    trxId: typeof data.trx_id === 'string' ? data.trx_id : input.trxId,
    amount: Number(data.amount ?? input.amount),
    fee: Number(data.fee ?? 0),
    netAmount: Number(data.net_amount ?? input.amount),
    currency: typeof data.currency === 'string' ? data.currency : 'BDT',
    status: typeof data.status === 'string' ? data.status : 'pending',
    methodCode: Number(data.method_code ?? CHAOPAOPAY_METHOD_CODE[input.method]),
    accountNumber: typeof data.account_number === 'string' ? data.account_number : input.accountNumber,
    createdAt: typeof data.created_at === 'string' ? data.created_at : null,
    raw: json,
  };
}
