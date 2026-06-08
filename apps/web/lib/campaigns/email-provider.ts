// Built by Anointed Coder.
//
// Email provider configuration probe. Returns true only when ALL of
// the required SMTP env vars are set. The actual SMTP dispatch is not
// yet wired (no nodemailer/sendgrid client lives in this codebase),
// so even when these env vars are present the campaign engine reports
// 'provider_setup_required' until an adapter is added. This file
// captures the required variable names in one place so the operator
// knows exactly what to populate.
//
// Required env vars (set in .env on the VPS):
//   EMAIL_SMTP_HOST
//   EMAIL_SMTP_PORT
//   EMAIL_SMTP_USER
//   EMAIL_SMTP_PASSWORD
//   EMAIL_FROM_ADDRESS
//
// Optional:
//   EMAIL_FROM_NAME
//   EMAIL_REPLY_TO

const REQUIRED_KEYS = [
  'EMAIL_SMTP_HOST',
  'EMAIL_SMTP_PORT',
  'EMAIL_SMTP_USER',
  'EMAIL_SMTP_PASSWORD',
  'EMAIL_FROM_ADDRESS',
] as const;

export function isEmailProviderConfigured(): boolean {
  for (const key of REQUIRED_KEYS) {
    if (!process.env[key] || process.env[key]!.trim() === '') return false;
  }
  return true;
}

export function missingEmailEnvKeys(): string[] {
  return REQUIRED_KEYS.filter((key) => !process.env[key] || process.env[key]!.trim() === '');
}
