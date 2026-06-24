// Built by Anointed Coder.
//
// Public probe used by the deposit page UI to decide whether to show
// the "Pay with bKash" / "Pay with Nagad" Quick Pay buttons. Returns
// the methods the operator has enabled and the min/max amounts. Does
// not expose the API key, secret key or merchant id.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { db } from '@/lib/db/client';
import { loadChaopaoPaySettings } from '@/lib/payments/chaopaopay-client';
import { jsonOk } from '@/lib/auth/errors';

// Operators frequently upload a brand icon on the GENERAL PaymentMethod
// row (used by the manual deposit + withdrawal tiles) but forget to
// upload the same icon on the ChaopaoPay-specific setting. Without a
// fallback the gateway tiles render the built-in bK/N badge even when
// the brand icon is sitting one row over in PaymentMethod.iconUrl.
// We match by substring on the method name so the operator can name
// the row "bKash", "bkash Send Money", "Nagad", etc. and still get
// picked up.
// Name aliases so an operator who named the PaymentMethod row in Bengali
// (বিকাশ / নগদ) or with a transliteration still gets matched. Before this
// the deposit gateway tile kept the built-in bK / N badge whenever the
// brand row was not named with the exact English word, even though the
// same icon showed correctly on the withdrawal picker.
const BRAND_ALIASES: Record<'bkash' | 'nagad', string[]> = {
  bkash: ['bkash', 'bikash', 'বিকাশ'],
  nagad: ['nagad', 'nogod', 'নগদ'],
};

async function findBrandIcon(brand: 'bkash' | 'nagad'): Promise<string | null> {
  try {
    const needles = BRAND_ALIASES[brand];
    const rows = await db.paymentMethod.findMany({
      where: { iconUrl: { not: null }, status: 'active' },
      select: { name: true, iconUrl: true, position: true },
      orderBy: { position: 'asc' },
    });
    const hit = rows.find((r) => {
      const name = r.name.toLowerCase();
      return needles.some((n) => name.includes(n));
    });
    return hit?.iconUrl ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  const cfg = await loadChaopaoPaySettings();
  const available = !!(cfg.enabled && cfg.merchantId && cfg.apiKey && cfg.secretKey);

  // ChaopaoPay-specific upload takes precedence; otherwise fall back to
  // the matching PaymentMethod iconUrl so a single upload at
  // /admin/payment-methods serves both the deposit gateway tiles and
  // the manual deposit + withdrawal pickers.
  const [bkashFallback, nagadFallback] = await Promise.all([
    cfg.bkashIcon ? Promise.resolve(null) : findBrandIcon('bkash'),
    cfg.nagadIcon ? Promise.resolve(null) : findBrandIcon('nagad'),
  ]);

  return jsonOk({
    available,
    methods: available ? ['bkash', 'nagad'] as const : ([] as const),
    // Display defaults. The gateway's actual per-method limits come
    // from ChaopaoPay support; until they confirm we use the
    // platform-wide deposit schema limits (100 min, 500,000 max).
    minAmount: 100,
    maxAmount: 500_000,
    currency: 'BDT',
    // Operator-uploaded tile icons (null when unset; the deposit page
    // falls back to the built-in bK / N badges).
    icons: {
      bkash: cfg.bkashIcon ?? bkashFallback,
      nagad: cfg.nagadIcon ?? nagadFallback,
    },
  });
}
