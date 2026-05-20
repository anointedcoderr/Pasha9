import type { Lang } from '@/lib/i18n/context';

export function formatBDT(amount: number, opts?: { sign?: boolean; compact?: boolean }) {
  const { sign = false, compact = false } = opts ?? {};
  const formatter = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: compact ? 1 : 0,
    notation: compact ? 'compact' : 'standard',
  });
  const value = formatter.format(Math.abs(amount));
  const prefix = sign && amount < 0 ? '-' : sign && amount > 0 ? '+' : '';
  return `${prefix}৳ ${value}`;
}

export function formatNumber(value: number, lang: Lang = 'en') {
  return new Intl.NumberFormat(lang === 'bn' ? 'bn-BD' : 'en-IN').format(value);
}

export function formatDate(date: Date | string, lang: Lang = 'en') {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function formatDateTime(date: Date | string | number, lang: Lang = 'en') {
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  return new Intl.DateTimeFormat(lang === 'bn' ? 'bn-BD' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function relativeTime(date: Date | string, lang: Lang = 'en') {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diff = (d.getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(lang === 'bn' ? 'bn-BD' : 'en', { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  return rtf.format(Math.round(diff / 86400), 'day');
}

export function maskAccount(account: string) {
  if (!account || account.length < 4) return account;
  return `${account.slice(0, 2)}${'*'.repeat(account.length - 4)}${account.slice(-2)}`;
}

export function maskPhone(phone: string) {
  if (!phone || phone.length < 4) return phone;
  return `${phone.slice(0, 3)} ***** ${phone.slice(-2)}`;
}
