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
// Android 14). These were each shipped as an isolated build and confirmed
// to launch. Everything NOT in that verified set was removed after several
// builds that combined them crashed on launch every time:
//
//   pullToRefreshEnabled            - wraps the WebView in a native
//                                     SwipeRefreshLayout; prime suspect for
//                                     the launch crash under the New
//                                     Architecture (newArchEnabled: true)
//   setSupportMultipleWindows       - changes native window-creation
//   allowsBackForwardNavigationGestures / decelerationRate - iOS-only, no
//                                     value on Android, still shipped native
//   injectedJavaScript              - the zoom-lock and auth-bridge scripts
//   onShouldStartLoadWithRequest    - tel:/mailto:/sms: interception
//
// Re-add any of them ONE AT A TIME, each in its own build, tested on a real
// device before the next. Bundling them back together is what caused five
// days of failed builds.
//
// Push notifications and the native splash screen are out for the same
// reason and come back the same way.
//
// Android hardware back steps back through the WebView's own history before
// falling through to the OS default (exit).

import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import WebView, { type WebViewNavigation } from 'react-native-webview';
import type { WebViewErrorEvent, WebViewHttpErrorEvent } from 'react-native-webview/lib/WebViewTypes';
import { SITE_URL } from '@/lib/config';
import { installCrashReporter } from '@/lib/crash-report';

installCrashReporter();

const BG = '#06120c';
const ACCENT = '#FFCC00';

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const canGoBackRef = useRef(false);
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
          domStorageEnabled
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
