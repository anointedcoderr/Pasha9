// Built by Anointed Coder.
//
// Mask helpers for provider request/response logging. Tokens,
// secrets and signed payloads are scrubbed before being written to
// ProviderRequestLog / ProviderCallbackLog. A stolen DB dump must
// not be enough to authenticate as the operator with iGamingAPIs.

const SENSITIVE_KEYS = new Set([
  'token', 'api_token', 'apitoken', 'apikey', 'api_key', 'secret',
  'secret_key', 'secretkey', 'signature', 'sign', 'hmac', 'password',
  'callback_secret', 'callbacksecret', 'authorization', 'key',
]);

const TOKEN_LOOKING = /^[A-Za-z0-9_\-/+=]{16,}$/;

function maskValue(v: string): string {
  if (v.length <= 6) return '••••';
  return `${v.slice(0, 2)}••••${v.slice(-4)}`;
}

// Keys whose string value is itself encrypted by the provider with
// the AEAD-encrypted apiSecret. Storing them verbatim is required
// for the "reprocess callback" workflow: an admin replays a saved
// callback log through the new parser, which needs the original
// ciphertext to decrypt. The plaintext is still protected behind
// the apiSecret (encrypted at rest via lib/crypto/aead.ts), so a
// stolen DB dump alone cannot read it.
const PRESERVED_KEYS = new Set(['payload', 'encrypted_payload', 'encryptedPayload']);

export function maskPayload(input: unknown, parentKey?: string): unknown {
  if (input == null) return input;
  if (typeof input === 'string') {
    // Preserve encrypted-payload-style fields so admin can reprocess.
    if (parentKey && PRESERVED_KEYS.has(parentKey)) return input;
    // base64/hex blobs longer than 64 chars are almost certainly
    // ciphertext (e.g. the encrypted launch payload). Keep the head
    // + tail for diffability.
    if (input.length > 64 && TOKEN_LOOKING.test(input)) return maskValue(input);
    return input;
  }
  if (Array.isArray(input)) return input.map((v) => maskPayload(v));
  if (typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      const lower = k.toLowerCase();
      if (SENSITIVE_KEYS.has(lower)) {
        out[k] = typeof v === 'string' ? maskValue(v) : '••••';
      } else {
        out[k] = maskPayload(v, k);
      }
    }
    return out;
  }
  return input;
}
