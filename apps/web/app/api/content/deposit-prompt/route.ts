// Built by Anointed Coder.
//
// Public read of the DepositRequiredModal content. Returns
// admin-customizable copy + the background config. Defaults are
// baked into the loader so the modal stays rendered even if the
// admin has not visited /admin/deposit-prompt yet.

export const dynamic = 'force-dynamic';

import { jsonOk } from '@/lib/auth/errors';
import { loadDepositPromptSettings } from '@/lib/deposit-prompt/settings';

export async function GET() {
  const settings = await loadDepositPromptSettings();
  return jsonOk(settings);
}
