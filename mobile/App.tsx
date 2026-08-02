// Built by Anointed Coder.
//
// Pasha9 player app: a thin native shell around the live website
// (SITE_URL). There is no native UI beyond a splash-matched loading state -
// every screen, every deposit/withdraw flow, every game launch is the real
// pasha9.com, so the app can never drift out of sync with the site and stays
// small (no duplicated screens, no native API client, no UI framework).
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
import { ActivityIndicator, BackHandler, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import WebView, { type WebViewMessageEvent, type WebViewNavigation } from 'react-native-webview';
import type { ShouldStartLoadRequest, WebViewErrorEvent, WebViewHttpErrorEvent } from 'react-native-webview/lib/WebViewTypes';
import { SITE_URL } from '@/lib/config';
import { ensureAndroidChannel, getExpoPushToken } from '@/lib/push/register';

const SPLASH_BG = '#06120c';
const ACCENT = '#FFCC00';

const AUTH_CHECK_SCRIPT = `
(function () {
  fetch('/api/auth/me', { credentials: 'include' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (j) {
      var userId = j && j.user && j.user.id ? j.user.id : null;
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'auth', userId: userId }));
    })
    .catch(function () {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'auth', userId: null }));
    });
})();
true;
`;

function buildRegisterTokenScript(token: string, appVersion: string): string {
  const body = JSON.stringify({ token, platform: Platform.OS, appVersion });
  return `
(function () {
  fetch('/api/me/device-tokens', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: ${JSON.stringify(body)}
  }).catch(function () {});
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

  // Push permission + channel setup happens once at launch, independent of
  // login state. Registering the resulting token with the backend still
  // waits for the auth-check bridge below to confirm a signed-in session.
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

  // Re-shown on every full navigation (app launch, or a notification deep
  // link's programmatic window.location.href change), not just the first
  // cold load. The site's own internal client-side routing never fires
  // these WebView-level events, so normal in-page browsing stays uninterrupted.
  const onLoadStart = useCallback(() => {
    setLoading(true);
  }, []);

  const onLoadEnd = useCallback(() => {
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
    setHasError(false);
    setLoading(true);
    webViewRef.current?.reload();
  }, []);

  // The one-way bridge: the page reports its own auth state (see
  // AUTH_CHECK_SCRIPT), and a newly-signed-in user triggers a native push
  // token fetch + a page-context POST to register it. Guarded so the same
  // user is only registered once per app session.
  const onMessage = useCallback((event: WebViewMessageEvent) => {
    let parsed: { type?: string; userId?: string | null } | null = null;
    try {
      parsed = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (parsed?.type !== 'auth') return;
    const userId = parsed.userId ?? null;
    if (!userId || registeredForUserRef.current === userId) return;
    registeredForUserRef.current = userId;
    void (async () => {
      const token = await getExpoPushToken();
      if (!token || !webViewRef.current) return;
      const appVersion = Constants.expoConfig?.version ?? '1.0.0';
      webViewRef.current.injectJavaScript(buildRegisterTokenScript(token, appVersion));
    })();
  }, []);

  const onShouldStartLoadWithRequest = useCallback((request: ShouldStartLoadRequest) => {
    const url = request.url;
    if (url.startsWith('tel:') || url.startsWith('mailto:') || url.startsWith('sms:')) {
      Linking.openURL(url).catch(() => undefined);
      return false;
    }
    return true;
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
          onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
          injectedJavaScript={AUTH_CHECK_SCRIPT}
          pullToRefreshEnabled
          allowsBackForwardNavigationGestures
          setSupportMultipleWindows={false}
          decelerationRate="normal"
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
  fill: { flex: 1, backgroundColor: SPLASH_BG },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: SPLASH_BG,
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
