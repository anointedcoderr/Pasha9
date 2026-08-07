// Built by Anointed Coder.
//
// Server-side Firebase Admin SDK initialization. Used by the Forgot
// Password "verify SMS code" endpoint to verify the Firebase ID token
// the client receives after the player completes Firebase Phone Auth,
// then extract the phone number to match against a Pasha 9 user.
//
// The SDK reads credentials from three env vars:
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY    (with literal \n; we replace them at runtime)
//
// Initialization is lazy + idempotent so hot-reload during development
// does not throw "The default Firebase app already exists".

import {
  getApps,
  initializeApp,
  cert,
  type App,
} from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';

const DEFAULT_APP_NAME = '[DEFAULT]';
const PLAYER_APP_NAME = 'player-push';

let cachedApp: App | null = null;
let cachedAuth: Auth | null = null;
let cachedMessaging: Messaging | null = null;

function readPrivateKey(): string {
  const raw = process.env.FIREBASE_PRIVATE_KEY ?? '';
  // Heroku / .env files store the PEM with literal \n; convert to real
  // newlines. Multi-line values that are already real newlines pass
  // through unchanged.
  return raw.replace(/\\n/g, '\n');
}

export function isFirebaseConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY,
  );
}

function getAdminApp(): App {
  if (cachedApp) return cachedApp;
  if (!isFirebaseConfigured()) {
    throw new Error('FIREBASE_ADMIN_NOT_CONFIGURED');
  }
  // Look the default app up BY NAME, not by getApps()[0]. There is now a
  // second, separately-credentialed app (player push, below), and index 0
  // is whichever happened to initialize first - which would silently hand
  // this project's Phone Auth and admin push the wrong credentials.
  const existing = getApps().find((a) => a.name === DEFAULT_APP_NAME);
  cachedApp = existing ?? initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: readPrivateKey(),
    }),
  });
  return cachedApp;
}

// ---------------------------------------------------------------------------
// Player mobile push - a SECOND Firebase project.
//
// The mobile app is built against its own Firebase project (the one in
// mobile/google-services.json), which is NOT the project used for Phone Auth
// and admin push. FCM will only deliver to devices registered under the same
// project as the sending credentials: sending to the app's tokens with the
// auth project's service account fails every message with
// messaging/mismatched-credential, which is exactly what production showed.
//
// Kept as separate env vars rather than replacing the originals, because the
// original project is what admin push and Phone Auth legitimately use. If
// these are unset, player FCM reports provider_setup_required and delivery
// falls back to Expo, so an unconfigured server degrades rather than breaks.
// ---------------------------------------------------------------------------

let cachedPlayerApp: App | null = null;
let cachedPlayerMessaging: Messaging | null = null;

function readPlayerPrivateKey(): string {
  return (process.env.FIREBASE_PLAYER_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');
}

export function isPlayerFcmConfigured(): boolean {
  return Boolean(
    process.env.FIREBASE_PLAYER_PROJECT_ID &&
    process.env.FIREBASE_PLAYER_CLIENT_EMAIL &&
    process.env.FIREBASE_PLAYER_PRIVATE_KEY,
  );
}

function getPlayerApp(): App {
  if (cachedPlayerApp) return cachedPlayerApp;
  if (!isPlayerFcmConfigured()) {
    throw new Error('FIREBASE_PLAYER_NOT_CONFIGURED');
  }
  const existing = getApps().find((a) => a.name === PLAYER_APP_NAME);
  cachedPlayerApp = existing ?? initializeApp(
    {
      credential: cert({
        projectId: process.env.FIREBASE_PLAYER_PROJECT_ID,
        clientEmail: process.env.FIREBASE_PLAYER_CLIENT_EMAIL,
        privateKey: readPlayerPrivateKey(),
      }),
    },
    PLAYER_APP_NAME,
  );
  return cachedPlayerApp;
}

/** FCM handle for the mobile app's own Firebase project. See block above. */
export function getPlayerFcmMessaging(): Messaging {
  if (cachedPlayerMessaging) return cachedPlayerMessaging;
  cachedPlayerMessaging = getMessaging(getPlayerApp());
  return cachedPlayerMessaging;
}

export function getFirebaseAdminAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  cachedAuth = getAuth(getAdminApp());
  return cachedAuth;
}

// Server-side FCM messaging handle. Reuses the same credentials and
// cached app as Phone Auth. Used by lib/push/fcm.ts to send admin
// phone push. Throws FIREBASE_ADMIN_NOT_CONFIGURED when the service
// account env vars are missing.
export function getFirebaseAdminMessaging(): Messaging {
  if (cachedMessaging) return cachedMessaging;
  cachedMessaging = getMessaging(getAdminApp());
  return cachedMessaging;
}

export interface VerifiedPhoneIdToken {
  uid: string;
  phoneNumber: string;    // E.164 format from Firebase, e.g. "+8801712345678"
  firebaseSignInProvider: string;
  expiresAt: Date;
}

// Verify a Firebase ID token (obtained client-side after the player
// completes the phone-auth flow). Returns the verified phone number
// in E.164 form. Throws on signature mismatch, expired token, missing
// phone claim, or unconfigured Firebase.
export async function verifyFirebasePhoneIdToken(idToken: string): Promise<VerifiedPhoneIdToken> {
  const auth = getFirebaseAdminAuth();
  // checkRevoked=true forces a lookup against the Firebase auth-state
  // for the uid. Stops a leaked token from being replayed after the
  // operator forced sign-out of the corresponding Firebase user.
  const decoded = await auth.verifyIdToken(idToken, /* checkRevoked */ true);
  const phoneNumber = typeof decoded.phone_number === 'string' ? decoded.phone_number.trim() : '';
  if (!phoneNumber) {
    throw new Error('NO_PHONE_CLAIM');
  }
  const provider = (decoded.firebase as { sign_in_provider?: string } | undefined)?.sign_in_provider ?? '';
  if (provider !== 'phone') {
    // Only phone-auth tokens are accepted for password reset.
    throw new Error('WRONG_SIGN_IN_PROVIDER');
  }
  return {
    uid: decoded.uid,
    phoneNumber,
    firebaseSignInProvider: provider,
    expiresAt: new Date(decoded.exp * 1000),
  };
}
