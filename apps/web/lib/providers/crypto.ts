// Built by Anointed Coder.
//
// AES-256-ECB helper for external game-provider payloads. Matches
// the iGamingAPIs / SoftAPI launch contract:
//
//   PHP reference:
//     openssl_encrypt(JSON, "AES-256-ECB", $KEY, OPENSSL_RAW_DATA)
//     -> base64(raw bytes)
//
// Node equivalent uses crypto.createCipheriv('aes-256-ecb', key, null)
// with the default PKCS7 padding, which is byte-identical to PHP's
// OpenSSL default for AES.
//
// Key encoding is configurable per provider so a future partner that
// expects a hex- or base64-decoded key can be supported without code
// changes. AES-256 always needs 32 raw key bytes; this module
// enforces that BEFORE any cipher op and throws a typed error with a
// clear admin-facing message.
//
// NOTE: ECB has known security weaknesses (identical plaintext
// blocks -> identical ciphertext blocks). We comply because the
// provider requires it; the operator should know that the secret
// rotation policy is the real defence here.

import { createCipheriv, createDecipheriv } from 'node:crypto';

export type ProviderSecretEncoding = 'utf8' | 'hex' | 'base64';

export class ProviderKeyError extends Error {
  constructor(public code: 'KEY_LENGTH_INVALID' | 'KEY_ENCODING_INVALID' | 'CIPHER_FAILED', message: string) {
    super(message);
    this.name = 'ProviderKeyError';
  }
}

const REQUIRED_KEY_BYTES = 32;

export function decodeProviderKey(secret: string, encoding: ProviderSecretEncoding): Buffer {
  if (typeof secret !== 'string' || secret.length === 0) {
    throw new ProviderKeyError('KEY_LENGTH_INVALID', 'Provider secret is empty.');
  }
  let buf: Buffer;
  switch (encoding) {
    case 'utf8':
      buf = Buffer.from(secret, 'utf8');
      break;
    case 'hex':
      if (!/^[0-9a-fA-F]+$/.test(secret) || secret.length % 2 !== 0) {
        throw new ProviderKeyError('KEY_ENCODING_INVALID', 'Provider secret marked hex but is not valid hex.');
      }
      buf = Buffer.from(secret, 'hex');
      break;
    case 'base64':
      try {
        buf = Buffer.from(secret, 'base64');
      } catch {
        throw new ProviderKeyError('KEY_ENCODING_INVALID', 'Provider secret marked base64 but failed to decode.');
      }
      break;
    default:
      throw new ProviderKeyError('KEY_ENCODING_INVALID', `Unsupported secret encoding: ${encoding}`);
  }
  if (buf.length !== REQUIRED_KEY_BYTES) {
    throw new ProviderKeyError(
      'KEY_LENGTH_INVALID',
      `AES-256-ECB requires a ${REQUIRED_KEY_BYTES}-byte key. Got ${buf.length} bytes after decoding as ${encoding}.`,
    );
  }
  return buf;
}

/**
 * Encrypts a UTF-8 string with AES-256-ECB + PKCS7 padding and
 * returns the ciphertext base64-encoded. Matches PHP openssl_encrypt
 * with OPENSSL_RAW_DATA + base64_encode.
 */
export function aesEcbEncryptBase64(plain: string, secret: string, encoding: ProviderSecretEncoding): string {
  const key = decodeProviderKey(secret, encoding);
  try {
    const cipher = createCipheriv('aes-256-ecb', key, null);
    cipher.setAutoPadding(true);
    const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return enc.toString('base64');
  } catch (err) {
    throw new ProviderKeyError('CIPHER_FAILED', `AES-256-ECB encrypt failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Round-trip helper used by the admin "Test encryption" button. We
 * encrypt a fixed sentinel + a timestamp, decrypt back, and confirm
 * the plaintext matches. Catches the most common admin mistakes:
 * pasting a 64-char hex string while leaving encoding=utf8.
 */
export function aesEcbDecryptBase64(ciphertextB64: string, secret: string, encoding: ProviderSecretEncoding): string {
  const key = decodeProviderKey(secret, encoding);
  try {
    const decipher = createDecipheriv('aes-256-ecb', key, null);
    decipher.setAutoPadding(true);
    const dec = Buffer.concat([
      decipher.update(Buffer.from(ciphertextB64, 'base64')),
      decipher.final(),
    ]);
    return dec.toString('utf8');
  } catch (err) {
    throw new ProviderKeyError('CIPHER_FAILED', `AES-256-ECB decrypt failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Self-check that admins call from /admin/providers/<id>/test-encryption.
 * Encrypts a sentinel payload and decrypts it back; returns the
 * ciphertext + decrypted plaintext so the operator can compare.
 */
export function selfTestEncryption(secret: string, encoding: ProviderSecretEncoding): {
  keyByteLength: number;
  ciphertext: string;
  decoded: string;
  matched: boolean;
} {
  const sentinel = JSON.stringify({ test: 'pasha9-provider-key-check', at: 'fixed' });
  const ct = aesEcbEncryptBase64(sentinel, secret, encoding);
  const pt = aesEcbDecryptBase64(ct, secret, encoding);
  return {
    keyByteLength: decodeProviderKey(secret, encoding).length,
    ciphertext: ct,
    decoded: pt,
    matched: pt === sentinel,
  };
}
