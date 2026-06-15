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

let cachedApp: App | null = null;
let cachedAuth: Auth | null = null;

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

export function getFirebaseAdminAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  if (!isFirebaseConfigured()) {
    throw new Error('FIREBASE_ADMIN_NOT_CONFIGURED');
  }
  if (!cachedApp) {
    const existing = getApps()[0];
    cachedApp = existing ?? initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: readPrivateKey(),
      }),
    });
  }
  cachedAuth = getAuth(cachedApp);
  return cachedAuth;
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
