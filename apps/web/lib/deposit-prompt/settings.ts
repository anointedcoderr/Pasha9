// Built by Anointed Coder.
//
// Pasha Deposit Required modal - admin-customizable content. Stored
// as SystemSetting key/value rows so the modal can be edited from
// /admin/deposit-prompt without a schema change. Safe defaults keep
// the modal working out of the box.

import { db } from '@/lib/db/client';

export const DEPOSIT_PROMPT_KEYS = {
  titleEn: 'deposit_prompt_title_en',
  titleBn: 'deposit_prompt_title_bn',
  messageEn: 'deposit_prompt_message_en',
  messageBn: 'deposit_prompt_message_bn',
  ctaEn: 'deposit_prompt_cta_en',
  ctaBn: 'deposit_prompt_cta_bn',
  bgType: 'deposit_prompt_bg_type',          // 'gradient' | 'image'
  bgImageUrl: 'deposit_prompt_bg_image_url',
  bgImageEnabled: 'deposit_prompt_bg_image_enabled', // 'true' | 'false'
  accent: 'deposit_prompt_accent',           // 'gold' | 'royal' | 'red' | 'emerald' | 'sapphire'
} as const;

export interface DepositPromptSettings {
  titleEn: string;
  titleBn: string;
  messageEn: string;
  messageBn: string;
  ctaEn: string;
  ctaBn: string;
  bgType: 'gradient' | 'image';
  bgImageUrl: string;
  bgImageEnabled: boolean;
  accent: 'gold' | 'royal' | 'red' | 'emerald' | 'sapphire';
}

export const DEFAULTS: DepositPromptSettings = {
  titleEn: 'Deposit Required',
  titleBn: 'ডিপোজিট দরকার',
  messageEn: 'You need wallet balance to place this bet. Top up your wallet to keep playing.',
  messageBn: 'এই বেট দিতে ওয়ালেটে ব্যালেন্স দরকার। চালিয়ে যেতে ওয়ালেট টপ-আপ করুন।',
  ctaEn: 'Deposit Now',
  ctaBn: 'এখনই ডিপোজিট',
  bgType: 'gradient',
  bgImageUrl: '',
  bgImageEnabled: false,
  accent: 'gold',
};

function pick<T extends string>(value: string | undefined | null, allowed: readonly T[], fallback: T): T {
  if (value && (allowed as readonly string[]).includes(value)) return value as T;
  return fallback;
}

export async function loadDepositPromptSettings(): Promise<DepositPromptSettings> {
  try {
    const keys = Object.values(DEPOSIT_PROMPT_KEYS);
    const rows = await db.systemSetting.findMany({ where: { key: { in: keys } } });
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = (r.value ?? '').trim();

    return {
      titleEn: map[DEPOSIT_PROMPT_KEYS.titleEn] || DEFAULTS.titleEn,
      titleBn: map[DEPOSIT_PROMPT_KEYS.titleBn] || DEFAULTS.titleBn,
      messageEn: map[DEPOSIT_PROMPT_KEYS.messageEn] || DEFAULTS.messageEn,
      messageBn: map[DEPOSIT_PROMPT_KEYS.messageBn] || DEFAULTS.messageBn,
      ctaEn: map[DEPOSIT_PROMPT_KEYS.ctaEn] || DEFAULTS.ctaEn,
      ctaBn: map[DEPOSIT_PROMPT_KEYS.ctaBn] || DEFAULTS.ctaBn,
      bgType: pick(map[DEPOSIT_PROMPT_KEYS.bgType], ['gradient', 'image'] as const, DEFAULTS.bgType),
      bgImageUrl: map[DEPOSIT_PROMPT_KEYS.bgImageUrl] || DEFAULTS.bgImageUrl,
      bgImageEnabled: (map[DEPOSIT_PROMPT_KEYS.bgImageEnabled] || '').toLowerCase() === 'true',
      accent: pick(map[DEPOSIT_PROMPT_KEYS.accent], ['gold', 'royal', 'red', 'emerald', 'sapphire'] as const, DEFAULTS.accent),
    };
  } catch (err) {
    console.error('[deposit-prompt] load failed, falling back to defaults', err);
    return DEFAULTS;
  }
}

export async function saveDepositPromptSettings(patch: Partial<DepositPromptSettings>): Promise<void> {
  const writes: Array<{ key: string; value: string }> = [];
  if (patch.titleEn !== undefined) writes.push({ key: DEPOSIT_PROMPT_KEYS.titleEn, value: patch.titleEn });
  if (patch.titleBn !== undefined) writes.push({ key: DEPOSIT_PROMPT_KEYS.titleBn, value: patch.titleBn });
  if (patch.messageEn !== undefined) writes.push({ key: DEPOSIT_PROMPT_KEYS.messageEn, value: patch.messageEn });
  if (patch.messageBn !== undefined) writes.push({ key: DEPOSIT_PROMPT_KEYS.messageBn, value: patch.messageBn });
  if (patch.ctaEn !== undefined) writes.push({ key: DEPOSIT_PROMPT_KEYS.ctaEn, value: patch.ctaEn });
  if (patch.ctaBn !== undefined) writes.push({ key: DEPOSIT_PROMPT_KEYS.ctaBn, value: patch.ctaBn });
  if (patch.bgType !== undefined) writes.push({ key: DEPOSIT_PROMPT_KEYS.bgType, value: patch.bgType });
  if (patch.bgImageUrl !== undefined) writes.push({ key: DEPOSIT_PROMPT_KEYS.bgImageUrl, value: patch.bgImageUrl });
  if (patch.bgImageEnabled !== undefined) writes.push({ key: DEPOSIT_PROMPT_KEYS.bgImageEnabled, value: patch.bgImageEnabled ? 'true' : 'false' });
  if (patch.accent !== undefined) writes.push({ key: DEPOSIT_PROMPT_KEYS.accent, value: patch.accent });

  for (const w of writes) {
    await db.systemSetting.upsert({
      where: { key: w.key },
      update: { value: w.value, type: 'string', category: 'content' },
      create: { key: w.key, value: w.value, type: 'string', category: 'content' },
    });
  }
}
