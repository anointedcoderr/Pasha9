// Built by Anointed Coder.
//
// "Detect group id" helper for the Telegram tab. Calls getUpdates with
// the saved bot token and lists every group / supergroup / channel the
// bot has seen recently (title + chat id) so a non-technical operator
// can pick the right group without ever typing a negative chat id.
//
// Empty list usually means the bot has not been added to the group yet
// or nobody has sent a message there since the bot joined; the UI
// explains that.

export const dynamic = 'force-dynamic';

import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';
import { listTelegramGroupChats } from '@/lib/telegram/notify';

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('settings.write');
    const result = await listTelegramGroupChats();
    return jsonOk({ ok: result.ok, chats: result.chats, error: result.error ?? null });
  });
}
