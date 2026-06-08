// Built by Anointed Coder.
//
// Web Push (VAPID) provider probe. Returns true only when both VAPID
// keys are present in the environment. The actual web-push dispatch
// is not wired in this codebase yet (no web-push npm dependency is
// installed) so even with the keys set the admin UI should report
// 'Provider setup required'. This file captures the env var names in
// one place so the operator knows what to populate when an adapter
// is added in a follow-up iteration.
//
// Required env vars:
//   VAPID_PUBLIC_KEY
//   VAPID_PRIVATE_KEY
//   VAPID_SUBJECT       (e.g. mailto:info@anointedcoder.com)

const REQUIRED_KEYS = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'] as const;

export function isVapidConfigured(): boolean {
  for (const key of REQUIRED_KEYS) {
    if (!process.env[key] || process.env[key]!.trim() === '') return false;
  }
  return true;
}

export function missingVapidKeys(): string[] {
  return REQUIRED_KEYS.filter((key) => !process.env[key] || process.env[key]!.trim() === '');
}

export function vapidProviderStatus(): {
  configured: boolean;
  missing: string[];
  message: string;
} {
  const configured = isVapidConfigured();
  return {
    configured,
    missing: missingVapidKeys(),
    message: configured
      ? 'VAPID keys detected. Push adapter must still be wired before any broadcast can dispatch.'
      : 'Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT in the server .env before browser push can be enabled.',
  };
}
