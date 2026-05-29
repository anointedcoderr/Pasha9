// Built by Anointed Coder.
//
// Defensive coercion helpers for the native-game UI layer. The
// server endpoints generally return well-typed numbers, but Decimal
// columns can occasionally serialize as strings, JSON parsing can
// fail, and user input can yield NaN. These helpers guarantee any
// value rendered into .toFixed() / formatBDT() is a finite number.

export function safeNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  if (value == null) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function safeArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function safeString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (value == null) return fallback;
  return String(value);
}

// Format helper that never throws on bad input.
export function safeToFixed(value: unknown, digits = 2): string {
  const n = safeNumber(value, 0);
  return n.toFixed(digits);
}
