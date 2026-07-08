// Built by Anointed Coder.
//
// Shared public-handle masking used by the live WinGo leaderboard and the
// live winners feed. Keeps the first two and last character, stars the
// middle; short names are partly starred too. Never leaks phone/email.

export function maskHandle(username: string | null | undefined, fallback = 'Player'): string {
  const name = (username ?? '').trim();
  if (!name) return fallback;
  if (name.length <= 3) return `${name.slice(0, 1)}**`;
  return `${name.slice(0, 2)}${'*'.repeat(Math.min(4, name.length - 3))}${name.slice(-1)}`;
}
