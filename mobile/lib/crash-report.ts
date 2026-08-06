// Built by Anointed Coder.
//
// Diagnostic-only, temporary. Reports the app's own uncaught JS errors to
// our backend, since we cannot get a live Metro/dev-client connection to a
// remote test device to see them directly. Installed at the very top of
// App.tsx (before anything else runs) so it catches a crash at any point,
// including module-evaluation time. Chains to React Native's own default
// handler afterward - this never suppresses the normal crash behaviour,
// it just also tells us why.

import { NativeModules, Platform } from 'react-native';
import Constants from 'expo-constants';
import { SITE_URL } from './config';

/**
 * Diagnostic-only, temporary. Reports a one-line status to the same endpoint
 * the crash reporter uses, so it surfaces in scripts/error-log.sh on the
 * server. Used to trace push-token registration on a remote test device,
 * since we have no direct access to that device or to the database.
 * Fire-and-forget: never throws, never blocks, failure is silent.
 */
export function reportDiagnostic(message: string): void {
  try {
    fetch(`${SITE_URL}/api/mobile/crash-log`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        message: `[diag] ${message}`,
        isFatal: false,
        platform: Platform.OS,
        osVersion: String(Platform.Version),
        appVersion: Constants.expoConfig?.version ?? null,
        device: NativeModules.PlatformConstants?.Model ?? null,
      }),
    }).catch(() => undefined);
  } catch {
    // Diagnostics must never affect the app.
  }
}

export function installCrashReporter(): void {
  try {
    const g = global as unknown as {
      ErrorUtils?: {
        getGlobalHandler: () => (error: unknown, isFatal?: boolean) => void;
        setGlobalHandler: (handler: (error: unknown, isFatal?: boolean) => void) => void;
      };
    };
    if (!g.ErrorUtils) return;

    const defaultHandler = g.ErrorUtils.getGlobalHandler();

    g.ErrorUtils.setGlobalHandler((error: unknown, isFatal?: boolean) => {
      try {
        const err = error instanceof Error ? error : new Error(String(error));
        const payload = {
          message: err.message,
          stack: err.stack ?? null,
          isFatal: !!isFatal,
          platform: Platform.OS,
          osVersion: String(Platform.Version),
          appVersion: Constants.expoConfig?.version ?? null,
          device: NativeModules.PlatformConstants?.Model ?? null,
        };
        // Best-effort, fire-and-forget. Must never throw or block the
        // default handler below, even if the network call itself fails.
        fetch(`${SITE_URL}/api/mobile/crash-log`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => undefined);
      } catch {
        // Reporting must never be the reason the real handler doesn't run.
      }
      defaultHandler(error, isFatal);
    });
  } catch {
    // No ErrorUtils on this platform/runtime - nothing to install.
  }
}
