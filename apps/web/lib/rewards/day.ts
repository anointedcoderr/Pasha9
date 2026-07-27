// Built by Anointed Coder.
//
// Shared reward "day" key. Daily check-in and daily free spins both
// bucket usage by this UTC calendar-day string (YYYY-MM-DD), so the two
// features reset on the exact same boundary and never disagree about
// what "today" means. Keep this identical to the DailyCheckInLog.day
// format documented in the Prisma schema.

export function rewardDayKey(d: Date = new Date()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Sentinel tierKey for the legacy untiered wheel (SpinResult.tierId is
// null there). DailyFreeSpinLog.tierKey is non-nullable so the
// @@unique([userId, tierKey, day]) constraint stays enforceable for the
// untiered wheel too (Postgres treats NULLs as distinct, which would
// otherwise let the unique key be duplicated).
export const LEGACY_SPIN_TIER_KEY = '__legacy__';
