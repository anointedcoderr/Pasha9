// Built by Anointed Coder.
//
// Round-trips the provider secret through AES-256-ECB and returns
// the ciphertext + decoded plaintext so the operator can confirm
// the secret + encoding are correct without exposing the secret
// value back to the client.

export const dynamic = 'force-dynamic';

import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';
import { decryptString } from '@/lib/crypto/aead';
import { selfTestEncryption, ProviderKeyError, type ProviderSecretEncoding } from '@/lib/providers/crypto';

function asEncoding(value: string | null | undefined): ProviderSecretEncoding {
  return value === 'hex' || value === 'base64' ? value : 'utf8';
}

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('settings.write');
    const row = await db.gameProvider.findUnique({ where: { id: params.id } });
    if (!row) return jsonError(404, 'NOT_FOUND');
    if (!row.apiSecret) return jsonError(400, 'SECRET_MISSING', 'No API secret stored for this provider.');
    let secret: string;
    try { secret = decryptString(row.apiSecret); } catch { return jsonError(500, 'SECRET_DECRYPT_FAILED'); }

    try {
      const result = selfTestEncryption(secret, asEncoding(row.secretEncoding));
      return jsonOk({
        ok: result.matched,
        keyByteLength: result.keyByteLength,
        ciphertextPreview: result.ciphertext.slice(0, 48) + (result.ciphertext.length > 48 ? '…' : ''),
        decodedPreview: result.decoded.slice(0, 48) + (result.decoded.length > 48 ? '…' : ''),
      });
    } catch (err) {
      if (err instanceof ProviderKeyError) {
        return jsonError(400, err.code, err.message);
      }
      return jsonError(500, 'TEST_FAILED', err instanceof Error ? err.message : String(err));
    }
  });
}
