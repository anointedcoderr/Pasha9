// Built by Anointed Coder.
//
// Bangladesh phone helpers for the SMS OTP flows. Player phone numbers
// are stored in mixed shapes (01XXXXXXXXX, 8801XXXXXXXXX, +8801...), so
// we canonicalise to the local 01XXXXXXXXX form for OtpCode keys and
// search every common variant when matching a User row.

// Returns the canonical local form 01XXXXXXXXX, or null when the input
// is not a valid Bangladesh mobile number.
export function canonicalBdPhone(input: string): string | null {
  const digits = (input || '').replace(/[^\d]/g, '');
  let local = digits;
  if (local.startsWith('880')) local = '0' + local.slice(3);
  else if (local.startsWith('88') && local.length === 13) local = '0' + local.slice(2);
  else if (local.length === 10 && local.startsWith('1')) local = '0' + local;
  // Valid BD mobile: 01 + operator digit (3-9) + 8 digits.
  if (!/^01[3-9]\d{8}$/.test(local)) return null;
  return local;
}

// Every common stored form for a canonical local number, so a User
// lookup matches regardless of how the row was saved.
export function bdPhoneSearchVariants(local: string): string[] {
  const noZero = local.slice(1); // 1XXXXXXXXX
  return Array.from(new Set([
    local,            // 01XXXXXXXXX
    `88${local}`,     // 8801XXXXXXXXX
    `+88${local}`,    // +8801XXXXXXXXX
    `880${noZero}`,   // 8801XXXXXXXXX
    `+880${noZero}`,  // +8801XXXXXXXXX
    noZero,           // 1XXXXXXXXX
  ]));
}
