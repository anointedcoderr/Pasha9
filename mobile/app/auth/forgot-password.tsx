// Built by Anointed Coder.
//
// FORGOT PASSWORD. Two visual steps on the shared dark shell:
//   1. Phone step  -> enter the account phone, tap Send OTP.
//   2. Verify step -> enter the 6-digit code and a new password, tap Reset.
// A small stepper shows progress. Everything is mock: Send OTP just advances
// the step and Reset routes back to login.

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
import { useRouter } from 'expo-router';
import { TextField, PrimaryButton, GhostButton, Gradient } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { gradients, colors } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { forgotStart, forgotComplete } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';

type Step = 'phone' | 'verify';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSendOtp() {
    if (submitting) return;
    setError(null);
    if (!phone.trim()) {
      setError('Enter your account phone number.');
      return;
    }
    setSubmitting(true);
    try {
      await forgotStart(phone);
      setStep('verify');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not send the code. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function onReset() {
    if (submitting) return;
    setError(null);
    if (!otp.trim() || !newPassword) {
      setError('Enter the code and a new password.');
      return;
    }
    setSubmitting(true);
    try {
      await forgotComplete({ phone, code: otp, newPassword });
      router.replace('/auth/login');
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not reset your password. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  const back = () => {
    if (step === 'verify') {
      setStep('phone');
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace('/auth/login');
  };

  return (
    <SafeAreaView className="flex-1 overflow-hidden bg-darkbg" edges={['top', 'bottom']}>
      <StatusBar style="light" />

      <View pointerEvents="none" className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold-500/10" />
      <View pointerEvents="none" className="absolute -left-20 bottom-0 h-64 w-64 rounded-full bg-blue-500/10" />

      <View className="flex-row items-center justify-between px-5 pt-2">
        <Pressable
          onPress={back}
          hitSlop={8}
          className="h-10 w-10 items-center justify-center rounded-xl bg-white/5 active:bg-white/10"
        >
          <Icon name="chevron-back" size={22} color="#ffffff" />
        </Pressable>
        <Text className="text-sm font-black text-white">Reset password</Text>
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
          {/* Icon + heading */}
          <View className="items-center">
            <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-2xl">
              <Gradient colors={gradients.gold} radius={16} />
              <Icon
                name={step === 'phone' ? 'key' : 'shield-checkmark'}
                size={24}
                color={colors.ink}
              />
            </View>
            <Text className="mt-3 text-2xl font-black tracking-tight text-white">
              {step === 'phone' ? 'Forgot password?' : 'Verify and reset'}
            </Text>
            <Text className="mt-1.5 max-w-[280px] text-center text-sm text-dink-mid">
              {step === 'phone'
                ? 'Enter your account phone number and we will send a one-time code.'
                : `Enter the code sent to ${phone || 'your phone'} and choose a new password.`}
            </Text>
          </View>

          {/* Stepper */}
          <Stepper step={step} />

          {/* Form card */}
          <View className="mt-5 rounded-2xl border border-divider bg-paper p-5 shadow-sm shadow-black/20">
            {step === 'phone' ? (
              <View className="gap-4">
                <TextField
                  label="Phone number"
                  icon="call-outline"
                  placeholder="01XXXXXXXXX"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  helper="We text a 6-digit code to this number."
                />
                {error ? <InlineError message={error} /> : null}
                <PrimaryButton
                  label={submitting ? 'Sending...' : 'Send OTP'}
                  icon="paper-plane-outline"
                  fullWidth
                  disabled={submitting}
                  onPress={onSendOtp}
                />
              </View>
            ) : (
              <View className="gap-4">
                <TextField
                  label="One-time code"
                  icon="keypad-outline"
                  placeholder="6-digit code"
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                />
                <PasswordField
                  value={newPassword}
                  onChangeText={setNewPassword}
                  label="New password"
                  placeholder="Create a new password"
                />
                {error ? <InlineError message={error} /> : null}
                <PrimaryButton
                  label={submitting ? 'Resetting...' : 'Reset password'}
                  icon="checkmark-circle-outline"
                  fullWidth
                  disabled={submitting}
                  onPress={onReset}
                />
                <View className="flex-row items-center justify-center gap-1.5">
                  <Text className="text-sm text-ink-mute">Did not get a code?</Text>
                  <Pressable onPress={() => setStep('phone')} hitSlop={6}>
                    <Text className="text-sm font-black text-gold-700">Resend</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>

          {/* Back to login */}
          <View className="mt-6">
            <GhostButton
              label="Back to login"
              icon="arrow-back-outline"
              fullWidth
              onPress={() => router.replace('/auth/login')}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Inline error banner shared by both steps.
function InlineError({ message }: { message: string }) {
  return (
    <View className="flex-row items-start gap-2 rounded-xl border border-hot/30 bg-hot/10 px-3 py-2.5">
      <Icon name="alert-circle" size={16} color={colors.hot} />
      <Text className="flex-1 text-xs font-semibold" style={{ color: colors.hot }}>
        {message}
      </Text>
    </View>
  );
}

// Two-dot progress rail: Phone -> Verify.
function Stepper({ step }: { step: Step }) {
  const verifyActive = step === 'verify';
  return (
    <View className="mt-5 flex-row items-center justify-center gap-2">
      <StepDot label="1" caption="Phone" active done={verifyActive} />
      <View className={cn('h-0.5 w-10 rounded-full', verifyActive ? 'bg-gold-500' : 'bg-white/15')} />
      <StepDot label="2" caption="Verify" active={verifyActive} />
    </View>
  );
}

function StepDot({
  label,
  caption,
  active,
  done,
}: {
  label: string;
  caption: string;
  active?: boolean;
  done?: boolean;
}) {
  const on = active || done;
  return (
    <View className="items-center gap-1">
      <View
        className={cn(
          'h-7 w-7 items-center justify-center rounded-full border',
          on ? 'border-gold-500 bg-gold-500' : 'border-white/20 bg-white/5',
        )}
      >
        {done ? (
          <Icon name="checkmark" size={15} color={colors.ink} />
        ) : (
          <Text className={cn('text-xs font-black', on ? 'text-ink' : 'text-dink-mid')}>
            {label}
          </Text>
        )}
      </View>
      <Text className={cn('text-[10px] font-bold', on ? 'text-dink-hi' : 'text-dink-lo')}>
        {caption}
      </Text>
    </View>
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
