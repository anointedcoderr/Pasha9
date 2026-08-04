// Built by Anointed Coder.
//
// Pasha9 player app: a thin native shell around the live website
// (SITE_URL). There is no native UI beyond a loading state - every screen,
// every deposit/withdraw flow, every game launch is the real pasha9.com, so
// the app can never drift out of sync with the site and stays small (no
// duplicated screens, no native API client, no UI framework).
//
// Push notifications and the native splash screen are deliberately not
// included here - both were isolated as the cause of a native crash on
// launch during testing and are being re-added separately once each has
// its own verified, non-crashing build.
//
// Android hardware back steps back through the WebView's own history before
// falling through to the OS default (exit).

import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import WebView, { type WebViewNavigation } from 'react-native-webview';
import type { ShouldStartLoadRequest, WebViewErrorEvent, WebViewHttpErrorEvent } from 'react-native-webview/lib/WebViewTypes';
import { SITE_URL } from '@/lib/config';
import { installCrashReporter } from '@/lib/crash-report';

// Diagnostic-only (see lib/crash-report.ts) - installed first, before
// anything else, so it can catch a crash at any later point including
// module-evaluation time.
installCrashReporter();

const BG = '#06120c';
const ACCENT = '#FFCC00';

// The site's own viewport meta tag may allow pinch/double-tap zoom (or be
// set after our injectedJavaScriptBeforeContentLoaded run, since a Next.js
// page can set it client-side). Re-applied on load and watched for changes
// so it sticks regardless of when or how the page sets its own.
const DISABLE_ZOOM_SCRIPT = `
(function () {
  function lockViewport() {
    var content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
    var meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'viewport';
      document.head.appendChild(meta);
    }
    if (meta.getAttribute('content') !== content) {
      meta.setAttribute('content', content);
    }
  }
  lockViewport();
  document.addEventListener('DOMContentLoaded', lockViewport);
  new MutationObserver(lockViewport).observe(document.documentElement, { childList: true, subtree: true });
})();
true;
`;

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const canGoBackRef = useRef(false);
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

  const onNavigationStateChange = useCallback((nav: WebViewNavigation) => {
    canGoBackRef.current = nav.canGoBack;
  }, []);

  // Re-shown on every full navigation (app launch, or a client-side route
  // change that reloads the page), not just the first cold load. The
  // site's own internal client-side routing never fires these WebView-level
  // events, so normal in-page browsing stays uninterrupted.
  const onLoadStart = useCallback(() => {
    setLoading(true);
  }, []);

  const onLoadEnd = useCallback(() => {
    setLoading(false);
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
          onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
          injectedJavaScript={DISABLE_ZOOM_SCRIPT}
          domStorageEnabled
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
