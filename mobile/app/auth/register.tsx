// Built by Anointed Coder.
//
// REGISTER. New player sign-up on the same dark premium shell as login.
// Collects username, a Bangladesh phone, a password, an optional referral
// code, and an agree-to-terms confirmation. Visual only: the Register
// button is enabled once the terms box is checked and then routes home.

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

export default function RegisterScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [referral, setReferral] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dismiss = () => (router.canGoBack() ? router.back() : router.replace('/'));

  async function onSubmit() {
    if (submitting || !agreed) return;
    setError(null);
    if (!username.trim() || !phone.trim() || !password) {
      setError('Fill in your username, phone and password.');
      return;
    }
    setSubmitting(true);
    try {
      await register({ username, phone, password, referral });
      router.replace('/');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not create your account. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 overflow-hidden bg-darkbg" edges={['top', 'bottom']}>
      <StatusBar style="light" />

      <View pointerEvents="none" className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold-500/10" />
      <View pointerEvents="none" className="absolute -left-20 bottom-0 h-64 w-64 rounded-full bg-blue-500/10" />

      <View className="flex-row items-center justify-between px-5 pt-2">
        <Pressable
          onPress={dismiss}
          hitSlop={8}
          className="h-10 w-10 items-center justify-center rounded-xl bg-white/5 active:bg-white/10"
        >
          <Ionicons name="chevron-down" size={22} color="#ffffff" />
        </Pressable>
        <Text className="text-sm font-black text-white">Create account</Text>
        <View className="h-10 w-10" />
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
            <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-2xl">
              <Gradient colors={gradients.gold} radius={14} />
              <Ionicons name="diamond" size={22} color={colors.ink} />
            </View>
            <Text className="mt-2.5 text-3xl font-black tracking-tight text-white">
              Join Pasha<Text style={{ color: colors.gold400 }}>9</Text>
            </Text>
            <Text className="mt-1.5 text-sm text-dink-mid">
              Set up your account in under a minute.
            </Text>
          </View>

          {/* Form card */}
          <View className="mt-6 rounded-2xl border border-divider bg-paper p-5 shadow-sm shadow-black/20">
            <View className="gap-4">
              <TextField
                label="Username"
                icon="person-outline"
                placeholder="Pick a unique handle"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />

              <TextField
                label="Phone number"
                icon="call-outline"
                placeholder="01XXXXXXXXX"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                helper="Bangladesh number. Standard SMS rates may apply."
              />

              <PasswordField
                value={password}
                onChangeText={setPassword}
                placeholder="Create a strong password"
              />

              <TextField
                label="Referral code (optional)"
                icon="gift-outline"
                placeholder="Enter a friend's code"
                value={referral}
                onChangeText={setReferral}
                autoCapitalize="characters"
              />

              {/* Agree to terms */}
              <Pressable
                onPress={() => setAgreed((a) => !a)}
                className="mt-1 flex-row items-start gap-2.5"
              >
                <View
                  className={cn(
                    'mt-0.5 h-5 w-5 items-center justify-center rounded-md border',
                    agreed ? 'border-gold-600 bg-gold-500' : 'border-divider bg-paper',
                  )}
                >
                  {agreed ? <Ionicons name="checkmark" size={14} color={colors.ink} /> : null}
                </View>
                <Text className="flex-1 text-xs leading-5 text-ink-soft">
                  I confirm I am 18 or older and agree to the{' '}
                  <Text
                    className="font-bold text-blue-600"
                    onPress={() => router.push('/legal/terms')}
                  >
                    Terms
                  </Text>{' '}
                  and{' '}
                  <Text
                    className="font-bold text-blue-600"
                    onPress={() => router.push('/legal/privacy')}
                  >
                    Privacy Policy
                  </Text>
                  .
                </Text>
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
                label={submitting ? 'Creating account...' : 'Register'}
                icon="sparkles-outline"
                fullWidth
                disabled={!agreed || submitting}
                onPress={onSubmit}
              />
            </View>

            {/* Login link */}
            <View className="mt-5 flex-row items-center justify-center gap-1.5">
              <Text className="text-sm text-ink-mute">Already have an account?</Text>
              <Pressable onPress={() => router.replace('/auth/login')} hitSlop={6}>
                <Text className="text-sm font-black text-gold-700">Login</Text>
              </Pressable>
            </View>
          </View>

          <View className="mt-6 flex-row items-center justify-center gap-1.5">
            <Ionicons name="shield-checkmark-outline" size={13} color={colors.dinkLo} />
            <Text className="text-[11px] text-dink-lo">
              Your details stay private. 18+ only.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

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
