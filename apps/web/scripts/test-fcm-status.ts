// Built by Anointed Coder.
// Standalone unit test for the pure FCM status helpers. Run with:
//   cd apps/web && npx tsx scripts/test-fcm-status.ts
import assert from 'node:assert/strict';
import { classifyFcmSendError, summarizeFcmResult } from '../lib/push/fcm-status';

// classifyFcmSendError
assert.equal(classifyFcmSendError('messaging/registration-token-not-registered'), 'expired');
assert.equal(classifyFcmSendError('messaging/invalid-registration-token'), 'expired');
assert.equal(classifyFcmSendError('messaging/internal-error'), 'transient');
assert.equal(classifyFcmSendError(undefined), 'transient');
assert.equal(classifyFcmSendError(null), 'transient');

// summarizeFcmResult
assert.equal(summarizeFcmResult(0, 0, 0), 'skipped_no_subscriptions');
assert.equal(summarizeFcmResult(3, 3, 0), 'sent');
assert.equal(summarizeFcmResult(3, 0, 3), 'failed');
assert.equal(summarizeFcmResult(3, 1, 2), 'partial');

console.log('fcm-status: all assertions passed');
