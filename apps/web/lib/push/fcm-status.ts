// Built by Anointed Coder.
//
// Pure helpers for the FCM admin push dispatcher. Kept free of any app
// imports (no Prisma, no firebase) so they are trivially unit-testable
// via tsx (see scripts/test-fcm-status.ts) and so the dispatcher's
// branching logic has a single tested source of truth.

export type FcmDispatchStatus =
  | 'sent'
  | 'partial'
  | 'failed'
  | 'provider_setup_required'
  | 'skipped_no_subscriptions';

export interface FcmDispatchResult {
  attempted: number;
  sent: number;
  failed: number;
  status: FcmDispatchStatus;
  details?: string | null;
}

// FCM error codes that mean the token is permanently dead and the
// AdminPushDevice row should be deactivated. Any other code is treated
// as transient (worth retrying on the next event).
export const EXPIRED_FCM_ERROR_CODES = new Set<string>([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

export function classifyFcmSendError(code: string | undefined | null): 'expired' | 'transient' {
  if (code && EXPIRED_FCM_ERROR_CODES.has(code)) return 'expired';
  return 'transient';
}

// Maps aggregate counts to the result status. Mirrors the policy used
// by the player web-push dispatcher in lib/push/dispatch.ts so the two
// channels report status the same way.
export function summarizeFcmResult(attempted: number, sent: number, failed: number): FcmDispatchStatus {
  if (attempted === 0) return 'skipped_no_subscriptions';
  if (sent === attempted) return 'sent';
  if (sent === 0) return 'failed';
  return 'partial';
}
