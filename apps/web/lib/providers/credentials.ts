// Built by Anointed Coder.
//
// Provider credential at-rest store. apiKey, apiSecret and
// callbackSecret are AEAD-encrypted via lib/crypto/aead.ts before
// hitting Postgres. Decryption only happens server-side inside the
// adapter pipeline, never in a response body.
//
// The shape exposed to callers is the LOADED credential record with
// plaintext secrets in memory. Anything returned to the admin UI
// must go through `maskedView` instead so the wire never carries the
// raw secret value.

import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { decryptString, encryptString } from '@/lib/crypto/aead';
import type { ProviderSecretEncoding } from './crypto';

export interface ProviderCreds {
  id: string;
  providerKey: string;
  adapterKey: string;
  name: string;
  apiBase: string;
  apiKey: string;            // decrypted in memory
  apiSecret: string;         // decrypted in memory
  secretEncoding: ProviderSecretEncoding;
  callbackPath: string;
  callbackSecret: string;    // decrypted in memory
  ipWhitelist: string[];
  clockSkewSeconds: number;
  currencyCode: string;
  language: string;
  callbackResponseMode: 'updated_balance' | 'net_loss_amount';
  launchMode: 'redirect' | 'iframe';
  /**
   * Optional offset in milliseconds added to Date.now() when the
   * adapter builds the launch timestamp. Defaults to 0. The base
   * timestamp is always generated fresh inside adapter.launch.
   */
  launchTimestampOffsetMs: number;
  /**
   * Per-provider override of the public HTTPS base URL used to
   * build the callback and player return URLs in the launch
   * payload. NULL falls back to PUBLIC_SITE_URL env then request
   * origin. Never include a path here - just the scheme + host.
   */
  publicBaseUrl: string | null;
  /**
   * Minimum BDT wallet balance required for the public launch
   * route to forward to the provider. 0 disables the check.
   */
  launchMinBalance: number;
  active: boolean;
}

function parseIpWhitelist(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function asEncoding(value: string | null | undefined): ProviderSecretEncoding {
  return value === 'hex' || value === 'base64' ? value : 'utf8';
}

function asResponseMode(value: string | null | undefined): 'updated_balance' | 'net_loss_amount' {
  return value === 'net_loss_amount' ? 'net_loss_amount' : 'updated_balance';
}

function asLaunchMode(value: string | null | undefined): 'redirect' | 'iframe' {
  return value === 'iframe' ? 'iframe' : 'redirect';
}

function safeDecrypt(blob: string | null | undefined): string {
  if (!blob) return '';
  try {
    return decryptString(blob);
  } catch (err) {
    console.error('[providers] failed to decrypt credential field', err);
    return '';
  }
}

export async function loadProviderCreds(providerKey: string): Promise<ProviderCreds | null> {
  const row = await db.gameProvider.findUnique({ where: { providerKey } });
  if (!row) return null;
  return {
    id: row.id,
    providerKey: row.providerKey ?? '',
    adapterKey: row.adapterKey ?? '',
    name: row.name,
    apiBase: row.apiBase ?? '',
    apiKey: safeDecrypt(row.apiKey),
    apiSecret: safeDecrypt(row.apiSecret),
    secretEncoding: asEncoding(row.secretEncoding),
    callbackPath: row.callbackPath ?? `/api/providers/${row.providerKey}/callback`,
    callbackSecret: safeDecrypt(row.callbackSecret),
    ipWhitelist: parseIpWhitelist(row.ipWhitelist),
    clockSkewSeconds: row.clockSkewSeconds,
    currencyCode: row.currencyCode ?? 'BDT',
    language: row.language ?? 'bn',
    callbackResponseMode: asResponseMode(row.callbackResponseMode),
    launchMode: asLaunchMode(row.launchMode),
    launchTimestampOffsetMs: row.launchTimestampOffsetMs ?? 0,
    publicBaseUrl: row.publicBaseUrl ?? null,
    launchMinBalance: row.launchMinBalance ? Number(row.launchMinBalance) : 0,
    active: row.status === 'active',
  };
}

export async function loadProviderCredsById(id: string): Promise<ProviderCreds | null> {
  const row = await db.gameProvider.findUnique({ where: { id } });
  if (!row || !row.providerKey) return null;
  return loadProviderCreds(row.providerKey);
}

export interface ProviderCredsPatch {
  apiKey?: string | null;        // plaintext input from admin form
  apiSecret?: string | null;
  callbackSecret?: string | null;
}

/**
 * Encrypts every plaintext secret in the patch into the AEAD blob
 * shape that GameProvider columns store. Skips fields that were not
 * supplied so an admin can edit non-secret fields without touching
 * secrets.
 */
export function buildCredentialUpdate(patch: ProviderCredsPatch): Prisma.GameProviderUncheckedUpdateInput {
  const out: Prisma.GameProviderUncheckedUpdateInput = {};
  if (patch.apiKey !== undefined && patch.apiKey !== null && patch.apiKey.length > 0) {
    out.apiKey = encryptString(patch.apiKey);
  }
  if (patch.apiSecret !== undefined && patch.apiSecret !== null && patch.apiSecret.length > 0) {
    out.apiSecret = encryptString(patch.apiSecret);
  }
  if (patch.callbackSecret !== undefined && patch.callbackSecret !== null && patch.callbackSecret.length > 0) {
    out.callbackSecret = encryptString(patch.callbackSecret);
  }
  return out;
}

/**
 * Masked view of credential fields for the admin UI. Returns the
 * last 4 characters only so the operator can confirm the value is
 * set without exposing the secret.
 */
export function maskSecret(plain: string | null | undefined): { set: boolean; preview: string } {
  if (!plain) return { set: false, preview: '' };
  if (plain.length <= 4) return { set: true, preview: '••••' };
  return { set: true, preview: `••••${plain.slice(-4)}` };
}
