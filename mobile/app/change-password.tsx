// Built by Anointed Coder.
//
// CHANGE PASSWORD, wired to POST /api/me/password. Current + new + confirm
// fields, client-side checks (confirm must match, new min 6 chars), and a
// WRONG_CURRENT_PASSWORD backend code mapped to a friendly inline message under
// the current-password field. On success it shows a confirmation state; every
// other failure surfaces the real backend message. A synchronous ref blocks a
// double submit.

import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Card, TextField, PrimaryButton } from '@/components/ui';
import { Icon } from '@/components/ui/Icon';
import { StackScreenHeader } from '@/components/StackScreenHeader';
import { useChangePassword } from '@/lib/api/account';
import { ApiError } from '@/lib/api/client';
import { colors } from '@/lib/theme';

const MIN_LENGTH = 6;

// Surface the real backend message when it carries one, else a friendly line.
function messageFor(err: unknown, fallback: string): string {
  return err instanceof ApiError ? (err.message !== err.code ? err.message : fallback) : fallback;
}

export default function ChangePasswordScreen() {
  const router = useRouter();
  const changePassword = useChangePassword();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [currentError, setCurrentError] = useState<string | null>(null);
  const [nextError, setNextError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const savingRef = useRef(false);
  const saving = changePassword.isPending;

  const canSubmit =
    current.length > 0 && next.length >= MIN_LENGTH && confirm.length > 0 && !saving;

  async function onSubmit() {
    if (savingRef.current) return;
    setSubmitError(null);
    setCurrentError(null);
    setNextError(null);
    setConfirmError(null);

    let invalid = false;
    if (current.length === 0) {
      setCurrentError('Enter your current password.');
      invalid = true;
    }
    if (next.length < MIN_LENGTH) {
      setNextError(`New password must be at least ${MIN_LENGTH} characters.`);
      invalid = true;
    }
    if (confirm !== next) {
      setConfirmError('Passwords do not match.');
      invalid = true;
    }
    if (invalid) return;

    savingRef.current = true;
    try {
      await changePassword.mutateAsync({ currentPassword: current, newPassword: next });
      setDone(true);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'WRONG_CURRENT_PASSWORD') {
        setCurrentError(messageFor(err, 'That is not your current password.'));
      } else if (err instanceof ApiError && err.code === 'VALIDATION') {
        setNextError(messageFor(err, 'That password is not allowed.'));
      } else {
        setSubmitError(messageFor(err, 'Could not change your password. Please try again.'));
      }
    } finally {
      savingRef.current = false;
    }
  }

  // ---- Success state -------------------------------------------------------
  if (done) {
    return (
      <Screen
        header={<StackScreenHeader title="Security and password" />}
        contentClassName="px-4 pt-6 gap-5"
      >
        <Card className="items-center gap-3 py-8">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-newg/15">
            <Icon name="checkmark-circle" size={38} color={colors.newg} />
          </View>
          <Text className="text-center text-lg font-black text-ink">Password updated</Text>
          <Text className="max-w-[300px] text-center text-sm text-ink-mute">
            Your password has been changed. Use it the next time you sign in.
          </Text>
          <View className="mt-2 w-full">
            <PrimaryButton label="Done" icon="arrow-back" fullWidth onPress={() => router.back()} />
          </View>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      header={<StackScreenHeader title="Security and password" subtitle="Change your password" />}
      contentClassName="px-4 pt-5 gap-5"
      footer={
        <View className="border-t border-divider bg-paper px-4 pb-7 pt-3">
          {submitError ? (
            <View className="mb-2 flex-row items-start gap-2 rounded-xl border border-hot/30 bg-hot/10 px-3 py-2">
              <Icon name="alert-circle" size={16} color={colors.hot} />
              <Text className="flex-1 text-xs font-medium text-hot">{submitError}</Text>
            </View>
          ) : null}
          <PrimaryButton
            label={saving ? 'Updating...' : 'Update password'}
            icon="lock-closed"
            fullWidth
            disabled={!canSubmit}
            loading={saving}
            onPress={onSubmit}
          />
        </View>
      }
    >
      <View className="gap-4">
        <TextField
          label="Current password"
          value={current}
          onChangeText={(t) => {
            setCurrent(t);
            if (currentError) setCurrentError(null);
          }}
          placeholder="Enter your current password"
          icon="lock-closed-outline"
          secureTextEntry
          error={currentError ?? undefined}
        />
        <TextField
          label="New password"
          value={next}
          onChangeText={(t) => {
            setNext(t);
            if (nextError) setNextError(null);
          }}
          placeholder="At least 6 characters"
          icon="key-outline"
          secureTextEntry
          error={nextError ?? undefined}
          helper={`Use at least ${MIN_LENGTH} characters`}
        />
        <TextField
          label="Confirm new password"
          value={confirm}
          onChangeText={(t) => {
            setConfirm(t);
            if (confirmError) setConfirmError(null);
          }}
          placeholder="Re-enter your new password"
          icon="key-outline"
          secureTextEntry
          error={confirmError ?? undefined}
        />
      </View>

      <View className="flex-row items-center gap-2 rounded-xl border border-divider bg-paper px-3 py-2.5">
        <Icon name="information-circle-outline" size={16} color={colors.inkMute} />
        <Text className="flex-1 text-[11px] text-ink-mute">
          Choose a password you do not use anywhere else.
        </Text>
      </View>
    </Screen>
  );
}
