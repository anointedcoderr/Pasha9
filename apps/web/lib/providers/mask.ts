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

export function maskPayload(input: unknown): unknown {
  if (input == null) return input;
  if (typeof input === 'string') {
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
        out[k] = maskPayload(v);
      }
    }
    return out;
  }
  return input;
}
