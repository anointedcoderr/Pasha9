// Built by Anointed Coder.
//
// Client-side Firebase Web SDK initialization. Only used by the
// Forgot Password "send SMS code" UI to invoke Firebase Phone Auth.
// Every NEXT_PUBLIC_* env var below is safe to ship to the browser
// per Firebase's published guidance - the values authenticate the
// Firebase PROJECT, not the user, and SMS abuse is gated by the
// Authentication > Settings > SMS region policy (BD-only) and the
// Firebase invisible reCAPTCHA verifier we attach to the send button.

'use client';

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  type Auth,
  type ConfirmationResult,
} from 'firebase/auth';

interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;

function readConfig(): FirebaseClientConfig | null {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
  if (!apiKey || !authDomain || !projectId || !storageBucket || !messagingSenderId || !appId) {
    return null;
  }
  return { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId };
}

export function isFirebaseClientConfigured(): boolean {
  return readConfig() !== null;
}

export function getFirebaseClientAuth(): Auth | null {
  if (cachedAuth) return cachedAuth;
  const cfg = readConfig();
  if (!cfg) return null;
  if (!cachedApp) {
    const existing = getApps()[0];
    cachedApp = existing ?? initializeApp(cfg);
  }
  cachedAuth = getAuth(cachedApp);
  // Force the phone-auth UI to render in Bangla when the operator
  // ships a Bangla SMS template; the default 'auto' picks browser
  // locale which is usually 'en-US' on mobile webviews. We honour
  // the user's lang context via setLanguageCode() in the hook below.
  return cachedAuth;
}

// Returns the cached Firebase web app (initializing it from the same
// NEXT_PUBLIC_* config), or null when the web config is missing. Used by
// lib/push/fcm-client.ts to obtain a Messaging instance for the admin
// "Enable phone alerts" flow.
export function getFirebaseClientApp(): FirebaseApp | null {
  const cfg = readConfig();
  if (!cfg) return null;
  if (!cachedApp) {
    const existing = getApps()[0];
    cachedApp = existing ?? initializeApp(cfg);
  }
  return cachedApp;
}

export type { ConfirmationResult };
