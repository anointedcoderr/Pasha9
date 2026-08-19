// Built by Anointed Coder.
//
// Telegram alert channel for the operator team. A private group +
// a BotFather bot receive the same admin events as the /admin bell
// (deposits, withdrawals, VIP requests, reward claims, affiliate
// applications, gateway auto-credits).
//
// Money-safety contract (same as SMS + push):
//   - strictly best-effort: every network call has a 5s abort timeout,
//     every failure is caught, logged to console and returned as
//     { ok: false } - never thrown to the caller,
//   - never called inside a money transaction; callers fire it after
//     the DB commit, fire-and-forget, exactly like dispatchFcmToUsers,
//   - settings are cached for 45s so hot submit paths do not add a
//     SystemSetting query per event.
//
// Config lives in SystemSetting so the operator manages it from
// /admin/notifications (Telegram tab), not from env files:
//   telegram_alerts_enabled  'true' | 'false'
//   telegram_bot_token       BotFather token (secret, masked in UI)
//   telegram_chat_id         target group / channel chat id

import { db } from '@/lib/db/client';

export const TELEGRAM_SETTING_KEYS = [
  'telegram_alerts_enabled',
  'telegram_bot_token',
  'telegram_chat_id',
  // Per-topic groups. Each falls back to telegram_chat_id when blank, so an
  // operator who configures none keeps exactly the current single-group
  // behaviour and nothing needs migrating.
  'telegram_chat_id_deposit',
  'telegram_chat_id_withdrawal',
  'telegram_chat_id_registration',
] as const;

/**
 * Which group a message belongs in. 'general' is the catch-all and is what
 * every existing caller gets by default, so routing is opt-in per message
 * rather than a change every call site has to make at once.
 */
export type TelegramTopic = 'deposit' | 'withdrawal' | 'registration' | 'general';

const SEND_TIMEOUT_MS = 5_000;
const SETTINGS_CACHE_MS = 45_000;

interface TelegramSettings {
  enabled: boolean;
  botToken: string;
  chatId: string;
  depositChatId: string;
  withdrawalChatId: string;
  registrationChatId: string;
}

let cache: { at: number; value: TelegramSettings } | null = null;

async function readSettingsFresh(): Promise<TelegramSettings> {
  const rows = await db.systemSetting.findMany({
    where: { key: { in: [...TELEGRAM_SETTING_KEYS] } },
    select: { key: true, value: true },
  });
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = (r.value ?? '').trim();
  return {
    enabled: (map.telegram_alerts_enabled ?? '').toLowerCase() === 'true',
    botToken: map.telegram_bot_token ?? '',
    chatId: map.telegram_chat_id ?? '',
    depositChatId: map.telegram_chat_id_deposit ?? '',
    withdrawalChatId: map.telegram_chat_id_withdrawal ?? '',
    registrationChatId: map.telegram_chat_id_registration ?? '',
  };
}

/**
 * Resolve the destination group for a topic, falling back to the general
 * chat id when that topic has no group configured. The fallback is what
 * makes this safe to ship without the operator having created the new
 * groups yet: unconfigured topics keep going where they always did rather
 * than silently going nowhere.
 */
function chatIdFor(settings: TelegramSettings, topic: TelegramTopic): string {
  if (topic === 'deposit' && settings.depositChatId) return settings.depositChatId;
  if (topic === 'withdrawal' && settings.withdrawalChatId) return settings.withdrawalChatId;
  if (topic === 'registration' && settings.registrationChatId) return settings.registrationChatId;
  return settings.chatId;
}

async function loadSettings(): Promise<TelegramSettings> {
  const now = Date.now();
  if (cache && now - cache.at < SETTINGS_CACHE_MS) return cache.value;
  const value = await readSettingsFresh();
  cache = { at: now, value };
  return value;
}

// Called by the admin settings PATCH route so a freshly saved token /
// chat id / toggle applies to the next event without waiting out the
// 45s cache window.
export function invalidateTelegramSettingsCache(): void {
  cache = null;
}

// Telegram HTML parse mode only treats <, > and & as markup, but we
// escape quotes too so a future attribute-context use stays safe.
export function escapeTelegramHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Absolute base for the plain admin links appended to alerts. Same env
// resolution order as lib/providers/site-url.ts, with the production
// domain as the final fallback.
export function publicSiteBaseUrl(): string {
  const envUrl =
    process.env.PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.PASHA9_PUBLIC_URL ||
    'https://pasha9.com';
  return envUrl.trim().replace(/\/+$/, '');
}

// Compact alert text: bold Bangla title first, English title next,
// one line of detail, then a plain admin link. All dynamic strings are
// escaped for HTML parse mode; the caller passes raw text.
export function buildAdminTelegramMessage(input: {
  titleEn: string;
  titleBn?: string | null;
  bodyEn?: string | null;
  linkUrl?: string | null;
}): string {
  const lines: string[] = [];
  const titleBn = (input.titleBn ?? '').trim();
  const titleEn = input.titleEn.trim();
  if (titleBn) {
    lines.push(`<b>${escapeTelegramHtml(titleBn)}</b>`);
    if (titleEn && titleEn !== titleBn) lines.push(escapeTelegramHtml(titleEn));
  } else {
    lines.push(`<b>${escapeTelegramHtml(titleEn)}</b>`);
  }
  const bodyEn = (input.bodyEn ?? '').trim();
  if (bodyEn) lines.push(escapeTelegramHtml(bodyEn));
  const link = (input.linkUrl ?? '').trim();
  if (link) {
    lines.push(link.startsWith('http') ? link : `${publicSiteBaseUrl()}${link}`);
  }
  return lines.join('\n');
}

export interface TelegramSendResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
}

interface TelegramApiResponse {
  ok?: boolean;
  description?: string;
  result?: unknown;
}

async function callTelegramApi(
  botToken: string,
  method: string,
  body?: Record<string, unknown>,
): Promise<{ ok: boolean; data: TelegramApiResponse | null; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => null)) as TelegramApiResponse | null;
    if (!res.ok || !data?.ok) {
      return { ok: false, data, error: data?.description ?? `HTTP ${res.status}` };
    }
    return { ok: true, data };
  } catch (err) {
    const msg = err instanceof Error ? (err.name === 'AbortError' ? 'Timed out after 5s' : err.message) : String(err);
    return { ok: false, data: null, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

// Sends one HTML-mode message to the configured group. Never throws.
// `text` must already be escaped / built (use buildAdminTelegramMessage
// for event alerts). Pass ignoreEnabled for the admin test button so
// the operator can verify credentials before switching alerts on.
export async function sendTelegramAlert(
  text: string,
  opts?: { ignoreEnabled?: boolean; topic?: TelegramTopic },
): Promise<TelegramSendResult> {
  try {
    const settings = await loadSettings();
    if (!settings.enabled && !opts?.ignoreEnabled) {
      return { ok: false, skipped: true, error: 'Telegram alerts are turned off.' };
    }
    const chatId = chatIdFor(settings, opts?.topic ?? 'general');
    if (!settings.botToken || !chatId) {
      return { ok: false, skipped: true, error: 'Bot token or chat id is not set.' };
    }
    const result = await callTelegramApi(settings.botToken, 'sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });
    if (!result.ok) {
      console.error('[telegram] send failed:', result.error);
      return { ok: false, error: result.error };
    }
    return { ok: true };
  } catch (err) {
    console.error('[telegram] send threw', err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export interface TelegramGroupChat {
  id: string;
  title: string;
  type: string;
}

// Reads getUpdates with the SAVED token and lists every group /
// supergroup / channel the bot has seen recently. Lets a non-technical
// operator pick the chat id without understanding negative ids. Reads
// settings fresh (no cache) because this runs right after a save.
export async function listTelegramGroupChats(): Promise<{
  ok: boolean;
  chats: TelegramGroupChat[];
  error?: string;
}> {
  try {
    const settings = await readSettingsFresh();
    if (!settings.botToken) {
      return { ok: false, chats: [], error: 'Bot token is not set. Save the token first.' };
    }
    // offset -100 reads the NEWEST 100 pending updates instead of the
    // oldest, so the "bot was just added to the group" event is seen
    // even when the bot has a long unread backlog. Telegram forgets
    // the skipped older updates on the next poll; that trade-off is
    // fine for this admin-only chat-id detector.
    const result = await callTelegramApi(settings.botToken, 'getUpdates', { limit: 100, offset: -100 });
    if (!result.ok) {
      return { ok: false, chats: [], error: result.error };
    }
    const updates = Array.isArray(result.data?.result) ? (result.data!.result as Array<Record<string, unknown>>) : [];
    const seen = new Map<string, TelegramGroupChat>();
    // Old group id -> new supergroup id, learned from the service
    // message Telegram posts when a basic group is upgraded.
    const migrations = new Map<string, string>();
    for (const update of updates) {
      for (const key of ['message', 'edited_message', 'channel_post', 'my_chat_member']) {
        const container = update[key] as {
          chat?: { id?: number | string; title?: string; type?: string };
          migrate_to_chat_id?: number | string;
        } | undefined;
        const chat = container?.chat;
        if (!chat || chat.id === undefined) continue;
        // Supergroup migration: the service message arrives on the OLD
        // group id and carries the new -100... id. Record the mapping
        // so the dead pre-migration id never reaches the picker.
        if (container?.migrate_to_chat_id !== undefined && container.migrate_to_chat_id !== null) {
          migrations.set(String(chat.id), String(container.migrate_to_chat_id));
        }
        const type = chat.type ?? '';
        if (type !== 'group' && type !== 'supergroup' && type !== 'channel') continue;
        const id = String(chat.id);
        seen.set(id, { id, title: chat.title ?? '(no title)', type });
      }
    }
    // Apply migrations after the scan so update order does not matter:
    // drop the pre-migration id and make sure the new supergroup id is
    // listed (messages sent to the old id would fail with 400).
    for (const [oldId, newId] of migrations) {
      const old = seen.get(oldId);
      seen.delete(oldId);
      if (!seen.has(newId)) {
        seen.set(newId, { id: newId, title: old?.title ?? '(no title)', type: 'supergroup' });
      }
    }
    return { ok: true, chats: Array.from(seen.values()) };
  } catch (err) {
    console.error('[telegram] getUpdates threw', err);
    return { ok: false, chats: [], error: err instanceof Error ? err.message : String(err) };
  }
}
