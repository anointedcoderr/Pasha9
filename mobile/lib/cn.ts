// Built by Anointed Coder.
// Minimal className joiner (no clsx dependency). Falsy parts are dropped so
// conditional classes read cleanly: cn('p-4', active && 'bg-gold-500').
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
