// Built by Anointed Coder.
// Small formatting helpers shared across screens and components.

/**
 * Format a number as Bangladeshi Taka, e.g. 5900 -> "BDT 5,900".
 * Uses the en-IN grouping (lakh/crore friendly) which matches how the web
 * app groups large balances.
 */
export function formatBDT(value: number, withSymbol = true): string {
  const grouped = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(Math.round(value));
  return withSymbol ? `BDT ${grouped}` : grouped;
}

/** Compact currency for tickers, e.g. 156000 -> "BDT 1.56L". */
export function formatBDTCompact(value: number): string {
  if (value >= 10_000_000) return `BDT ${(value / 10_000_000).toFixed(2)}Cr`;
  if (value >= 100_000) return `BDT ${(value / 100_000).toFixed(2)}L`;
  if (value >= 1000) return `BDT ${(value / 1000).toFixed(1)}K`;
  return `BDT ${value}`;
}

/** Title-case a slug or key, e.g. "betting-pass" -> "Betting Pass". */
export function titleCase(input: string): string {
  return input
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
