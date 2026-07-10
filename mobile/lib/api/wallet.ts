// Built by Anointed Coder.
//
// Typed API functions for the live Pasha9 WALLET surface: bonuses / balances,
// deposit (create + proof upload + bonus preview + methods), withdrawal
// (eligibility + limits + create), and the transaction ledger. These are thin:
// they shape the request, call the shared client, and return typed payloads.
// Token storage, the { ok } envelope unwrap, and 401 refresh all live in
// lib/api/client.ts, so every function here just types what it reads.

import { api } from './client';

// ---------------------------------------------------------------------------
// Bonuses + balances (GET /api/bonuses/me)
// ---------------------------------------------------------------------------

export interface WalletBalances {
  balance: number;
  bonusBalance: number;
  lockedBalance: number;
}

export interface BonusTotals {
  locked: number;
  released: number;
  forfeited: number;
}

export type BonusGrantStatus = 'active' | 'completed' | 'expired' | 'cancelled' | string;

export interface BonusGrant {
  id: string;
  amount: number;
  turnoverRequired: number;
  turnoverProgress: number;
  status: BonusGrantStatus;
  sourceType: string | null;
  claimedAt: string | null;
  expiresAt: string | null;
  releasedAt: string | null;
  cancelledAt: string | null;
  note: string | null;
  rule: {
    id: string;
    name: string;
    type: string;
    description: string | null;
    turnoverX: number;
    validityDays: number | null;
  } | null;
}

export interface BonusesMe {
  wallet: WalletBalances;
  totals: BonusTotals;
  grants: BonusGrant[];
}

interface BonusesMeResponse {
  ok: true;
  wallet: WalletBalances | null;
  totals: BonusTotals;
  grants: BonusGrant[];
}

/**
 * GET /api/bonuses/me. Live wallet balances plus the player's bonus grants and
 * turnover progress. A missing wallet row normalises to zeros so the UI always
 * has numbers to render.
 */
export async function getBonusesMe(): Promise<BonusesMe> {
  const res = await api.get<BonusesMeResponse>('/api/bonuses/me');
  return {
    wallet: res.wallet ?? { balance: 0, bonusBalance: 0, lockedBalance: 0 },
    totals: res.totals ?? { locked: 0, released: 0, forfeited: 0 },
    grants: Array.isArray(res.grants) ? res.grants : [],
  };
}

// ---------------------------------------------------------------------------
// Payment methods (GET /api/content/payment-methods)
// ---------------------------------------------------------------------------

export interface PaymentMethod {
  id: string;
  name: string;
  type: string;
  number: string | null;
  instruction: string | null;
  instructionBn: string | null;
  payoutInstruction: string | null;
  payoutInstructionBn: string | null;
  iconUrl: string | null;
  bannerUrl: string | null;
  minDeposit: number | null;
  maxDeposit: number | null;
  minWithdrawal: number | null;
  maxWithdrawal: number | null;
  badgeLabelEn: string | null;
  badgeLabelBn: string | null;
  badgeEnabled: boolean;
}

interface PaymentMethodsResponse {
  ok: true;
  deposit: PaymentMethod[];
  payout: PaymentMethod[];
}

export interface PaymentMethods {
  deposit: PaymentMethod[];
  payout: PaymentMethod[];
}

/**
 * GET /api/content/payment-methods. Public, split into deposit + payout
 * channels so each form can render only the relevant options with their
 * per-method min/max hints. Called without a bearer (public content).
 */
export async function getPaymentMethods(): Promise<PaymentMethods> {
  const res = await api.get<PaymentMethodsResponse>('/api/content/payment-methods', { auth: false });
  return {
    deposit: Array.isArray(res.deposit) ? res.deposit : [],
    payout: Array.isArray(res.payout) ? res.payout : [],
  };
}

// ---------------------------------------------------------------------------
// Deposit bonus preview (GET /api/content/deposit-preview)
// ---------------------------------------------------------------------------

export interface DepositPreview {
  amount: number;
  bonusPercentage: number;
  bonusAmount: number;
  totalCredit: number;
  promotionName: string | null;
}

interface DepositPreviewResponse {
  ok?: true;
  amount?: number;
  bonusPercentage?: number;
  bonusAmount?: number;
  totalCredit?: number;
  promotionName?: string | null;
}

/**
 * GET /api/content/deposit-preview?amount=. Best-effort live bonus preview as
 * the player edits the amount. Returns zeros when no active tier matches.
 */
export async function getDepositPreview(amount: number, promotionId?: string | null): Promise<DepositPreview> {
  const params = new URLSearchParams({ amount: String(Math.round(amount)) });
  if (promotionId) params.set('promotionId', promotionId);
  const res = await api.get<DepositPreviewResponse>(
    `/api/content/deposit-preview?${params.toString()}`,
    { auth: false },
  );
  return {
    amount: Number(res.amount) || amount,
    bonusPercentage: Number(res.bonusPercentage) || 0,
    bonusAmount: Number(res.bonusAmount) || 0,
    totalCredit: Number(res.totalCredit) || amount,
    promotionName: typeof res.promotionName === 'string' ? res.promotionName : null,
  };
}

// ---------------------------------------------------------------------------
// Create deposit (POST /api/deposits)
// ---------------------------------------------------------------------------

export interface CreateDepositInput {
  amount: number;
  method: string;
  transactionId: string;
  proofUrl?: string | null;
  promotionId?: string | null;
  promoCode?: string | null;
}

export interface DepositResult {
  id: string;
  amount: number;
  method: string;
  transactionId: string;
  status: string;
  createdAt: string;
  bonusPercentage: number;
  bonusAmount: number;
  totalCredit: number;
  proofUrl: string | null;
}

interface CreateDepositResponse {
  ok: true;
  deposit: DepositResult;
}

/** POST /api/deposits. Writes a pending deposit for admin approval. */
export async function createDeposit(input: CreateDepositInput): Promise<DepositResult> {
  const res = await api.post<CreateDepositResponse>('/api/deposits', {
    amount: input.amount,
    method: input.method,
    transactionId: input.transactionId,
    proofUrl: input.proofUrl ?? undefined,
    promotionId: input.promotionId ?? undefined,
    promoCode: input.promoCode ?? undefined,
  });
  return res.deposit;
}

// ---------------------------------------------------------------------------
// Deposit proof upload (POST /api/deposits/proof, multipart)
// ---------------------------------------------------------------------------

/** A picked image ready to be sent as multipart form-data on React Native. */
export interface ProofFile {
  uri: string;
  name: string;
  type: string;
}

interface UploadProofResponse {
  ok: true;
  proofUrl: string;
  bytes: number;
}

/**
 * POST /api/deposits/proof. Uploads a payment screenshot and returns the
 * /uploads/ path the deposit submission then attaches as proofUrl. On RN a
 * FormData file part is the { uri, name, type } triple.
 */
export async function uploadDepositProof(file: ProofFile): Promise<{ proofUrl: string; bytes: number }> {
  const form = new FormData();
  // React Native's FormData accepts the { uri, name, type } shape for a file
  // part; the DOM typings do not, hence the cast.
  form.append('file', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
  const res = await api.upload<UploadProofResponse>('/api/deposits/proof', form);
  return { proofUrl: res.proofUrl, bytes: res.bytes };
}

// ---------------------------------------------------------------------------
// Withdrawal limits (GET /api/content/withdrawal-limits)
// ---------------------------------------------------------------------------

export interface WithdrawalLimits {
  min: number;
  max: number;
  policy: string;
}

interface WithdrawalLimitsResponse {
  ok: true;
  min: number;
  max: number;
  policy: string;
}

/** GET /api/content/withdrawal-limits. Public global min/max + policy note. */
export async function getWithdrawalLimits(): Promise<WithdrawalLimits> {
  const res = await api.get<WithdrawalLimitsResponse>('/api/content/withdrawal-limits', { auth: false });
  return {
    min: Number(res.min) || 500,
    max: Number(res.max) || 200_000,
    policy: typeof res.policy === 'string' ? res.policy : '',
  };
}

// ---------------------------------------------------------------------------
// Withdrawal eligibility (GET /api/withdrawals/eligibility)
// ---------------------------------------------------------------------------

export interface WithdrawalEligibility {
  multiplier: number;
  approvedDepositTotal: number;
  depositRequired: number;
  depositCompleted: number;
  depositRemaining: number;
  bettingPassRequired: number;
  bettingPassCompleted: number;
  bettingPassRemaining: number;
  referralRequired: number;
  referralCompleted: number;
  referralRemaining: number;
  requiredTurnover: number;
  completedTurnover: number;
  remainingTurnover: number;
  isMet: boolean;
  bdtBalanceLocked: number;
  referralBalanceLocked: number;
}

type WithdrawalEligibilityResponse = { ok: true } & Partial<WithdrawalEligibility>;

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);

/**
 * GET /api/withdrawals/eligibility. The combined turnover status the withdraw
 * screen uses to gate the submit button and render the remaining-turnover
 * reason. The POST route enforces the same rule server-side.
 */
export async function getWithdrawalEligibility(): Promise<WithdrawalEligibility> {
  const r = await api.get<WithdrawalEligibilityResponse>('/api/withdrawals/eligibility');
  return {
    multiplier: num(r.multiplier),
    approvedDepositTotal: num(r.approvedDepositTotal),
    depositRequired: num(r.depositRequired),
    depositCompleted: num(r.depositCompleted),
    depositRemaining: num(r.depositRemaining),
    bettingPassRequired: num(r.bettingPassRequired),
    bettingPassCompleted: num(r.bettingPassCompleted),
    bettingPassRemaining: num(r.bettingPassRemaining),
    referralRequired: num(r.referralRequired),
    referralCompleted: num(r.referralCompleted),
    referralRemaining: num(r.referralRemaining),
    requiredTurnover: num(r.requiredTurnover),
    completedTurnover: num(r.completedTurnover),
    remainingTurnover: num(r.remainingTurnover),
    isMet: Boolean(r.isMet),
    bdtBalanceLocked: num(r.bdtBalanceLocked),
    referralBalanceLocked: num(r.referralBalanceLocked),
  };
}

// ---------------------------------------------------------------------------
// Create withdrawal (POST /api/withdrawals)
// ---------------------------------------------------------------------------

export interface CreateWithdrawalInput {
  amount: number;
  method: string;
  accountNumber: string;
  accountName?: string;
}

export interface WithdrawalResult {
  id: string;
  amount: number;
  method: string;
  accountNumber: string;
  accountName: string;
  status: string;
  createdAt: string;
}

interface CreateWithdrawalResponse {
  ok: true;
  withdrawal: WithdrawalResult;
}

/** POST /api/withdrawals. Writes a pending withdrawal for admin approval. */
export async function createWithdrawal(input: CreateWithdrawalInput): Promise<WithdrawalResult> {
  const res = await api.post<CreateWithdrawalResponse>('/api/withdrawals', {
    amount: input.amount,
    method: input.method,
    accountNumber: input.accountNumber,
    accountName: input.accountName ?? undefined,
  });
  return res.withdrawal;
}

// ---------------------------------------------------------------------------
// Transaction ledger (GET /api/me/transactions)
// ---------------------------------------------------------------------------

export type TransactionType = 'deposit' | 'withdraw' | 'bonus' | 'referral' | 'bet' | 'win' | 'adjust';
export type TransactionStatus = 'completed' | 'pending' | 'failed' | string;

export interface LedgerTransaction {
  id: string;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  reference: string | null;
  description: string | null;
  createdAt: string;
  meta: unknown;
}

interface TransactionsResponse {
  ok: true;
  transactions: LedgerTransaction[];
  total: number;
}

export interface TransactionsQuery {
  /** Server-side type filter. Omit for all types. */
  type?: TransactionType | null;
  /** How many newest rows to return (server caps at 200). */
  take?: number;
}

export interface TransactionsPage {
  transactions: LedgerTransaction[];
  total: number;
}

/**
 * GET /api/me/transactions. The endpoint returns the newest `take` rows (no
 * cursor), merging synthetic pending / rejected deposit + withdrawal rows on
 * top of the real ledger. "Load more" is a larger `take`.
 */
export async function getTransactions(query: TransactionsQuery = {}): Promise<TransactionsPage> {
  const params = new URLSearchParams();
  if (query.type) params.set('type', query.type);
  params.set('take', String(query.take ?? 25));
  const qs = params.toString();
  const res = await api.get<TransactionsResponse>(`/api/me/transactions?${qs}`);
  return {
    transactions: Array.isArray(res.transactions) ? res.transactions : [],
    total: typeof res.total === 'number' ? res.total : 0,
  };
}
