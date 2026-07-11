// Built by Anointed Coder.
//
// Root layout. Loads the compiled Tailwind stylesheet (global.css), mounts the
// data + session providers (QueryClientProvider, AuthProvider), wraps the tree
// in GestureHandlerRootView + SafeAreaProvider, and declares the navigation
// Stack. An AuthGate redirects signed-out players to /auth/login and keeps
// signed-in players out of the auth group, so router.push('/wallet') etc. only
// resolve to protected screens once a live session exists.

import '../global.css';

import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/store/auth';
import { PushGate } from '@/components/PushGate';
import { colors } from '@/lib/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar style="dark" />
            <PushGate />
            <AuthGate>
              <RootStack />
            </AuthGate>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Redirect logic. Runs after the session resolves: guests are pushed to the
// login screen, and an authed player who is still sitting on an auth screen is
// bounced to the home tabs. While the session is loading we do nothing (the
// Stack stays mounted so navigation is always ready) and paint a plain dark
// screen over it to avoid a flash of protected content.
function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    const inAuthGroup = segments[0] === 'auth';
    if (status === 'guest' && !inAuthGroup) {
      router.replace('/auth/login');
    } else if (status === 'authed' && inAuthGroup) {
      router.replace('/');
    }
  }, [status, segments, router]);

  return (
    <View style={{ flex: 1 }}>
      {children}
      {status === 'loading' ? (
        <View
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.darkbg }}
        />
      ) : null}
    </View>
  );
}

function RootStack() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.surface },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="games" />
      <Stack.Screen name="wallet" />
      <Stack.Screen name="deposit" />
      <Stack.Screen name="withdraw" />
      <Stack.Screen name="transactions" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="vip" />
      <Stack.Screen name="rewards" />
      <Stack.Screen name="affiliate" />
      <Stack.Screen name="leaderboard" />
      <Stack.Screen name="sports" />
      <Stack.Screen name="auth" options={{ presentation: 'modal' }} />
      <Stack.Screen name="legal" />
    </Stack>
  );
}
