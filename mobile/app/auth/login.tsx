// Built by Anointed Coder.
//
// LOGIN. Premium dark sign-in for the Pasha9 player app. A gold wordmark
// sits above a light form card so the shared TextField reads at full
// contrast. Everything is visual only this phase: the Login button routes
// to the home tabs, and the Forgot / Register links move within the auth
// stack. Includes a BN / EN language toggle to mirror the web player app.

import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { TextField, PrimaryButton, Gradient } from '@/components/ui';
import { gradients, colors } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { useAuth } from '@/store/auth';
import { ApiError } from '@/lib/api/client';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [lang, setLang] = useState<'EN' | 'BN'>('EN');
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dismiss = () => (router.canGoBack() ? router.back() : router.replace('/'));

  async function onSubmit() {
    if (submitting) return;
    setError(null);
    if (!account.trim() || !password) {
      setError('Enter your phone or username and password.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await signIn({ username: account, password });
      if (result.kind === 'challenge') {
        // Player has TOTP enabled. In-app 2FA lands in a later phase; for now
        // point them to the website to finish the challenge.
        setError('This account uses two-factor authentication. Please sign in on the website to continue.');
        return;
      }
      router.replace('/');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Something went wrong signing in. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 overflow-hidden bg-darkbg" edges={['top', 'bottom']}>
      <StatusBar style="light" />

      {/* Ambient premium glows */}
      <View pointerEvents="none" className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold-500/10" />
      <View pointerEvents="none" className="absolute -left-20 bottom-0 h-64 w-64 rounded-full bg-blue-500/10" />

      {/* Fixed top row: close + language toggle */}
      <View className="flex-row items-center justify-between px-5 pt-2">
        <Pressable
          onPress={dismiss}
          hitSlop={8}
          className="h-10 w-10 items-center justify-center rounded-xl bg-white/5 active:bg-white/10"
        >
          <Ionicons name="chevron-down" size={22} color="#ffffff" />
        </Pressable>
        <LangToggle value={lang} onChange={setLang} />
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingHorizontal: 24,
            paddingVertical: 16,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand block */}
          <View className="items-center">
            <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-2xl">
              <Gradient colors={gradients.gold} radius={16} />
              <Ionicons name="diamond" size={26} color={colors.ink} />
            </View>
            <Text className="mt-3 text-4xl font-black tracking-tight text-white">
              Pasha<Text style={{ color: colors.gold400 }}>9</Text>
            </Text>
            <Text className="mt-1.5 text-sm text-dink-mid">
              Welcome back. Sign in to keep the streak going.
            </Text>
          </View>

          {/* Form card */}
          <View className="mt-6 rounded-2xl border border-divider bg-paper p-5 shadow-sm shadow-black/20">
            <Text className="text-xl font-black text-ink">Sign in</Text>
            <Text className="mt-0.5 text-xs text-ink-mute">
              Use the phone or username on your account.
            </Text>

            <View className="mt-4 gap-4">
              <TextField
                label="Phone or username"
                icon="person-outline"
                placeholder="01XXXXXXXXX or handle"
                value={account}
                onChangeText={setAccount}
                autoCapitalize="none"
              />

              <PasswordField value={password} onChangeText={setPassword} />

              <Pressable
                onPress={() => router.push('/auth/forgot-password')}
                hitSlop={6}
                className="self-end"
              >
                <Text className="text-xs font-bold text-blue-600">Forgot password?</Text>
              </Pressable>

              {error ? (
                <View className="flex-row items-start gap-2 rounded-xl border border-hot/30 bg-hot/10 px-3 py-2.5">
                  <Ionicons name="alert-circle" size={16} color={colors.hot} />
                  <Text className="flex-1 text-xs font-semibold" style={{ color: colors.hot }}>
                    {error}
                  </Text>
                </View>
              ) : null}

              <PrimaryButton
                label={submitting ? 'Signing in...' : 'Login'}
                icon="log-in-outline"
                fullWidth
                disabled={submitting}
                onPress={onSubmit}
              />
            </View>

            {/* Register link */}
            <View className="mt-5 flex-row items-center justify-center gap-1.5">
              <Text className="text-sm text-ink-mute">New to Pasha9?</Text>
              <Pressable onPress={() => router.push('/auth/register')} hitSlop={6}>
                <Text className="text-sm font-black text-gold-700">Register</Text>
              </Pressable>
            </View>
          </View>

          {/* Trust footer */}
          <View className="mt-6 items-center gap-2.5">
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="shield-checkmark-outline" size={13} color={colors.dinkLo} />
              <Text className="text-[11px] text-dink-lo">18+ only. Please play responsibly.</Text>
            </View>
            <View className="flex-row items-center gap-3">
              <FooterLink label="Terms" onPress={() => router.push('/legal/terms')} />
              <View className="h-3 w-px bg-white/15" />
              <FooterLink label="Privacy" onPress={() => router.push('/legal/privacy')} />
              <View className="h-3 w-px bg-white/15" />
              <FooterLink label="Support" onPress={() => router.push('/legal/support')} />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// BN / EN toggle. Visual only: flips a local flag with a gold active pill.
function LangToggle({
  value,
  onChange,
}: {
  value: 'EN' | 'BN';
  onChange: (v: 'EN' | 'BN') => void;
}) {
  return (
    <View className="flex-row items-center rounded-pill border border-white/10 bg-white/5 p-0.5">
      {(['EN', 'BN'] as const).map((l) => {
        const active = value === l;
        return (
          <Pressable
            key={l}
            onPress={() => onChange(l)}
            className={cn('rounded-pill px-3 py-1.5', active && 'bg-gold-500')}
          >
            <Text className={cn('text-xs font-black', active ? 'text-ink' : 'text-dink-mid')}>
              {l}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function FooterLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={6}>
      <Text className="text-[11px] font-semibold text-dink-mid">{label}</Text>
    </Pressable>
  );
}

// Password input with a Show / Hide toggle. Renders its own label row so the
// shared TextField stays untouched while still getting the leading lock icon.
function PasswordField({
  value,
  onChangeText,
  label = 'Password',
  placeholder = 'Enter your password',
}: {
  value: string;
  onChangeText: (t: string) => void;
  label?: string;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <View className="gap-1.5">
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-bold text-ink-soft">{label}</Text>
        <Pressable onPress={() => setShow((s) => !s)} hitSlop={6}>
          <Text className="text-xs font-bold text-blue-600">{show ? 'Hide' : 'Show'}</Text>
        </Pressable>
      </View>
      <TextField
        icon="lock-closed-outline"
        placeholder={placeholder}
        secureTextEntry={!show}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
      />
    </View>
  );
}
