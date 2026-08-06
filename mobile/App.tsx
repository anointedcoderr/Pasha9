// Built by Anointed Coder.
//
// Pasha9 player app: a thin native shell around the live website
// (SITE_URL). There is no native UI beyond a loading state - every screen,
// every deposit/withdraw flow, every game launch is the real pasha9.com, so
// the app can never drift out of sync with the site and stays small (no
// duplicated screens, no native API client, no UI framework).
//
// IMPORTANT - do not add WebView props here casually. The prop set below is
// exactly the one verified crash-free on the client's device (a Samsung on
// Android 14), grown one prop per build with a device test in between.
// These props were REMOVED during the crash hunt and must NOT come back as
// a group - several builds that combined them crashed on launch every time:
//
//   pullToRefreshEnabled            - wraps the WebView in a native
//                                     SwipeRefreshLayout; prime suspect for
//                                     the launch crash under the New
//                                     Architecture (newArchEnabled: true)
//   setSupportMultipleWindows       - changes native window-creation
//   allowsBackForwardNavigationGestures / decelerationRate - iOS-only, no
//                                     value on Android, still shipped native
//   onShouldStartLoadWithRequest    - tel:/mailto:/sms: interception
//
// Re-add any of them ONE AT A TIME, each in its own build, tested on a real
// device before the next. Bundling them back together is what caused five
// days of failed builds.
//
// Two small native bridges into the page, both one-way:
//   1. Auth check - re-injected after every page load. The page fetches its
//      own /api/auth/me (same-origin, so its httpOnly session cookie rides
//      along automatically) and posts back whether a player is signed in.
//      Native code never touches the session cookie directly.
//   2. Push registration - once signed-in is confirmed, native code fetches
//      the device's Expo push token (a native-only API) and hands it BACK to
//      the page to POST from page context, again riding the page's own
//      cookie rather than any native auth flow.
//
// Android hardware back steps back through the WebView's own history before
// falling through to the OS default (exit).

import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import WebView, { type WebViewMessageEvent, type WebViewNavigation } from 'react-native-webview';
import type { WebViewErrorEvent, WebViewHttpErrorEvent } from 'react-native-webview/lib/WebViewTypes';
import { SITE_URL } from '@/lib/config';
import { ensureAndroidChannel, getExpoPushToken } from '@/lib/push/register';
import { installCrashReporter, reportDiagnostic } from '@/lib/crash-report';

installCrashReporter();

const BG = '#06120c';
const ACCENT = '#FFCC00';

// Runs in page context after every load, so the session cookie rides along
// automatically. Reports back whether a player is signed in.
//
// CRITICAL - this must KEEP CHECKING, not run once. injectedJavaScript fires
// on document load only, and the site is a Next.js app: signing in swaps the
// UI through client-side routing without a new document load. A one-shot
// check therefore sees "logged out" at launch and never runs again, so a
// player who installs the app and then signs in never registers a push
// token at all - which is exactly why push appeared dead while the in-app
// notification bell still worked. Re-checking on an interval covers sign-in,
// sign-out, and switching accounts, and needs no cooperation from the site.
// It also listens for the site's own pasha9:auth-changed event for an
// instant response once that ships; the interval is the fallback that works
// regardless. Native side de-dupes, so repeats are cheap and harmless.
const AUTH_CHECK_SCRIPT = `
(function () {
  if (window.__pasha9AuthWatch) return;
  window.__pasha9AuthWatch = true;
  var last;
  function report() {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        var userId = j && j.user && j.user.id ? j.user.id : null;
        if (userId === last) return;
        last = userId;
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'auth', userId: userId }));
      })
      .catch(function () {});
  }
  report();
  setInterval(report, 15000);
  window.addEventListener('pasha9:auth-changed', report);
})();
true;
`;

// The token is POSTed from page context (not natively) so the player's own
// session cookie authenticates it - see /api/me/device-tokens, which requires
// an active player session.
function buildRegisterTokenScript(token: string, appVersion: string): string {
  const body = JSON.stringify({ token, platform: Platform.OS, appVersion });
  return `
(function () {
  fetch('/api/me/device-tokens', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: ${JSON.stringify(body)}
  })
    .then(function (r) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'tokenPost', status: r.status }));
    })
    .catch(function () {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'tokenPost', status: 0 }));
    });
})();
true;
`;
}

function buildNavigateScript(url: string): string {
  return `window.location.href = ${JSON.stringify(url)}; true;`;
}

/** Resolve a backend notification linkUrl (already a real site path) to a full URL. */
function resolveNotificationUrl(linkUrl?: string | null): string {
  const path = typeof linkUrl === 'string' && linkUrl.startsWith('/') ? linkUrl : '/dashboard/notifications';
  return `${SITE_URL}${path}`;
}

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const canGoBackRef = useRef(false);
  const registeredForUserRef = useRef<string | null>(null);
  const pendingUrlRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  // WebView can fire onLoadStart again after the page has already finished
  // loading once (a sub-resource or redirect on a complex site, not a fresh
  // navigation) - without this guard that re-shows the full-screen spinner
  // with no matching onLoadEnd ever arriving to dismiss it again. Reset only
  // on an explicit retry/reload, which is a genuine fresh load.
  const hasLoadedOnceRef = useRef(false);

  // Android hardware back: step back through page history first, only let
  // the OS handle it (exit) once there is nowhere left to go back to.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBackRef.current) {
        webViewRef.current?.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, []);

  // Channel setup happens once at launch, independent of login state. The
  // Android "default" channel must exist for heads-up delivery while the app
  // is backgrounded or the screen is off.
  useEffect(() => {
    void ensureAndroidChannel();
  }, []);

  // A notification tap while the app is backgrounded/killed opens it; once
  // the WebView exists, forward the tap's target page into it.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { linkUrl?: string | null } | undefined;
      const url = resolveNotificationUrl(data?.linkUrl);
      if (webViewRef.current) {
        webViewRef.current.injectJavaScript(buildNavigateScript(url));
      } else {
        pendingUrlRef.current = url;
      }
    });
    return () => sub.remove();
  }, []);

  const onNavigationStateChange = useCallback((nav: WebViewNavigation) => {
    canGoBackRef.current = nav.canGoBack;
  }, []);

  const onLoadStart = useCallback(() => {
    if (hasLoadedOnceRef.current) return;
    setLoading(true);
  }, []);

  const onLoadEnd = useCallback(() => {
    hasLoadedOnceRef.current = true;
    setLoading(false);
    if (pendingUrlRef.current && webViewRef.current) {
      webViewRef.current.injectJavaScript(buildNavigateScript(pendingUrlRef.current));
      pendingUrlRef.current = null;
    }
  }, []);

  // Network failure, DNS error, or an HTTP error status on the main frame
  // (server down, Cloudflare block, etc). Without this the player sees the
  // OS's own unbranded "can't reach this page" screen with no way back in -
  // a near-certain occurrence eventually (bad signal, a deploy mid-request),
  // so it needs a branded, recoverable state, not silence.
  const onError = useCallback((_event: WebViewErrorEvent) => {
    setLoading(false);
    setHasError(true);
  }, []);
  const onHttpError = useCallback((_event: WebViewHttpErrorEvent) => {
    setLoading(false);
    setHasError(true);
  }, []);

  const onRetry = useCallback(() => {
    hasLoadedOnceRef.current = false;
    setHasError(false);
    setLoading(true);
    webViewRef.current?.reload();
  }, []);

  // The one-way bridge: the page reports its own auth state (see
  // AUTH_CHECK_SCRIPT), and a newly-signed-in user triggers a native push
  // token fetch plus a page-context POST to register it. Guarded so the same
  // user is only registered once per app session.
  const onMessage = useCallback((event: WebViewMessageEvent) => {
    let parsed: { type?: string; userId?: string | null; status?: number } | null = null;
    try {
      parsed = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (parsed?.type === 'tokenPost') {
      // 200 = registered, 401 = session not seen by the POST, 0 = network.
      reportDiagnostic(`push: device-tokens POST returned ${parsed.status}`);
      return;
    }
    if (parsed?.type !== 'auth') return;
    const userId = parsed.userId ?? null;
    if (!userId || registeredForUserRef.current === userId) return;
    registeredForUserRef.current = userId;
    void (async () => {
      const token = await getExpoPushToken();
      if (!token) {
        // Most likely: notification permission denied, or no EAS projectId
        // in this build. Either way no push can ever arrive, so say so
        // rather than failing silently.
        reportDiagnostic('push: signed in but NO token (permission denied or no projectId)');
        return;
      }
      if (!webViewRef.current) return;
      const appVersion = Constants.expoConfig?.version ?? '1.0.0';
      reportDiagnostic(`push: got token ${token.slice(0, 24)}..., posting to /api/me/device-tokens`);
      webViewRef.current.injectJavaScript(buildRegisterTokenScript(token, appVersion));
    })();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
        {/* Always mounted, even under the error overlay below - the retry
            button calls webViewRef.current.reload(), which needs the ref to
            stay attached to a live WebView instance rather than being
            unmounted and losing its ref. */}
        <WebView
          ref={webViewRef}
          source={{ uri: SITE_URL }}
          style={styles.fill}
          onNavigationStateChange={onNavigationStateChange}
          onLoadStart={onLoadStart}
          onLoadEnd={onLoadEnd}
          onError={onError}
          onHttpError={onHttpError}
          onMessage={onMessage}
          injectedJavaScript={AUTH_CHECK_SCRIPT}
          domStorageEnabled
          setBuiltInZoomControls={false}
        />
        {loading && !hasError ? (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color={ACCENT} accessibilityLabel="Loading Pasha9" />
          </View>
        ) : null}
        {hasError ? (
          <View style={styles.loadingOverlay}>
            <Text style={styles.errorTitle}>Can&apos;t reach Pasha9</Text>
            <Text style={styles.errorBody}>Check your internet connection and try again.</Text>
            <Pressable
              onPress={onRetry}
              style={styles.retryButton}
              accessibilityRole="button"
              accessibilityLabel="Try again"
            >
              <Text style={styles.retryLabel}>Try again</Text>
            </Pressable>
          </View>
        ) : null}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: BG },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    color: '#f4fff7',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorBody: {
    color: '#bcd9c6',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: ACCENT,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryLabel: {
    color: '#3A1F00',
    fontSize: 15,
    fontWeight: '700',
  },
});
