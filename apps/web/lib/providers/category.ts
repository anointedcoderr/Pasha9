// Built by Anointed Coder.
//
// Provider category normalizer. Aggregator panels return wildly
// inconsistent category strings (Slot vs Slots vs SLOTS, casino vs
// table, Fish vs Fishing). We normalize at insert time so the admin
// Games tab can filter cleanly and the public catalog can show
// useful category chips.
//
// Original (panel-supplied) value is preserved on rawMeta so we
// can audit a row's source later.

export type NormalizedCategory = 'slots' | 'flash' | 'table' | 'fishing' | 'crash';

const MAP: Record<string, NormalizedCategory> = {
  // slots family
  slot: 'slots',
  slots: 'slots',
  // flash / instant
  flash: 'flash',
  instant: 'flash',
  // table family (operator spec: table/casino/card all collapse to table)
  table: 'table',
  card: 'table',
  cards: 'table',
  casino: 'table',
  poker: 'table',
  baccarat: 'table',
  blackjack: 'table',
  // fishing family
  fish: 'fishing',
  fishing: 'fishing',
  // crash family
  crash: 'crash',
};

export function normalizeCategory(raw: string | null | undefined): NormalizedCategory {
  const key = (raw ?? '').trim().toLowerCase();
  if (!key) return 'slots';
  if (MAP[key]) return MAP[key];
  // Tolerate panel typos like "Slotss" / " slot " by trying singular
  // fallback after stripping whitespace.
  const singular = key.endsWith('s') ? key.slice(0, -1) : key;
  if (MAP[singular]) return MAP[singular];
  return 'slots';
}

export function isNumericGameUid(value: string | null | undefined): boolean {
  if (!value) return false;
  const v = String(value).trim();
  if (!v) return false;
  return /^\d+$/.test(v);
}

export const CATEGORY_OPTIONS: NormalizedCategory[] = ['slots', 'flash', 'table', 'fishing', 'crash'];
