import type { Lang } from '@/lib/i18n/context';

// All format helpers are defensive: any non-finite number, null,
// undefined, or invalid date input renders a safe fallback instead
// of throwing. Intl.DateTimeFormat.format(InvalidDate) throws
// RangeError in V8 and was a crash source on the admin transaction
// log.

function safeFinite(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v as number);
  return Number.isFinite(n) ? n : 0;
}

function toValidDate(date: unknown): Date | null {
  if (date == null) return null;
  if (date instanceof Date) {
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const d = new Date(date as string | number);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatBDT(amount: number | string | null | undefined, opts?: { sign?: boolean; compact?: boolean }) {
  const { sign = false, compact = false } = opts ?? {};
  const v = safeFinite(amount);
  const formatter = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: compact ? 1 : 0,
    notation: compact ? 'compact' : 'standard',
  });
  const value = formatter.format(Math.abs(v));
  const prefix = sign && v < 0 ? '-' : sign && v > 0 ? '+' : '';
  return `${prefix}৳ ${value}`;
}

export function formatNumber(value: number | string | null | undefined, lang: Lang = 'en') {
  return new Intl.NumberFormat(lang === 'bn' ? 'bn-BD' : 'en-IN').format(safeFinite(value));
}

export function formatDate(date: Date | string | null | undefined, lang: Lang = 'en') {
  const d = toValidDate(date);
  if (!d) return '-';
  try {
    return new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch { return '-'; }
}

export function formatDateTime(date: Date | string | number | null | undefined, lang: Lang = 'en') {
  const d = toValidDate(date);
  if (!d) return '-';
  try {
    return new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch { return '-'; }
}

export function relativeTime(date: Date | string | null | undefined, lang: Lang = 'en') {
  const d = toValidDate(date);
  if (!d) return '-';
  try {
    const diff = (d.getTime() - Date.now()) / 1000;
    const rtf = new Intl.RelativeTimeFormat(lang === 'bn' ? 'bn-BD' : 'en', { numeric: 'auto' });
    const abs = Math.abs(diff);
    if (abs < 60) return rtf.format(Math.round(diff), 'second');
    if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
    if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
    return rtf.format(Math.round(diff / 86400), 'day');
  } catch { return '-'; }
}

export function maskAccount(account: string) {
  if (!account || account.length < 4) return account;
  return `${account.slice(0, 2)}${'*'.repeat(account.length - 4)}${account.slice(-2)}`;
}

export function maskPhone(phone: string) {
  if (!phone || phone.length < 4) return phone;
  return `${phone.slice(0, 3)} ***** ${phone.slice(-2)}`;
}
