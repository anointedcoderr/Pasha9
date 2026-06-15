// Built by Anointed Coder.
//
// Bangladesh phone-number normalisation helpers. The legacy register
// route stores phone numbers in whatever format the player typed
// (local "01712345678", E.164 "+8801712345678", or country-prefixed
// "8801712345678"). Firebase Phone Auth always returns E.164, so the
// Forgot Password flow needs to match across all storage formats.

export interface BdPhoneVariants {
  e164: string;     // +8801712345678
  local: string;    // 01712345678
  bare: string;     // 1712345678
  all: string[];    // every variant the lookup should try
}

// Returns null when the input is not a recognisable BD mobile number.
export function bdPhoneVariants(input: string | null | undefined): BdPhoneVariants | null {
  if (!input) return null;
  const cleaned = input.replace(/[^\d+]/g, '');
  // Strip leading +/+880/880/0 to isolate the bare 10-digit local
  // number, which always starts with 1 in Bangladesh.
  let bare = cleaned;
  if (bare.startsWith('+')) bare = bare.slice(1);
  if (bare.startsWith('880')) bare = bare.slice(3);
  if (bare.startsWith('0')) bare = bare.slice(1);
  if (!/^1[3-9]\d{8}$/.test(bare)) return null;
  const e164 = `+880${bare}`;
  const local = `0${bare}`;
  return {
    e164,
    local,
    bare,
    all: Array.from(new Set([e164, local, bare, `880${bare}`])),
  };
}
