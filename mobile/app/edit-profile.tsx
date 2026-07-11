// Built by Anointed Coder.
//
// EDIT PROFILE, wired to the live backend. Prefills from the cached session
// user, lets the player change their avatar (expo-image-picker -> POST
// /api/me/avatar) and edit username / phone / email (PATCH /api/me/profile,
// changed fields only). Backend field clashes (USERNAME_TAKEN / PHONE_TAKEN /
// EMAIL_TAKEN) and VALIDATION are surfaced inline; every save merges the
// returned user back into the session via patchUser so the header and account
// screen update immediately.

import { useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Screen, TextField, PrimaryButton } from '@/components/ui';
import { StackScreenHeader } from '@/components/StackScreenHeader';
import { useAuth } from '@/store/auth';
import {
  useUpdateProfile,
  useUploadAvatar,
  type UpdateProfileInput,
} from '@/lib/api/account';
import { ApiError } from '@/lib/api/client';
import { colors } from '@/lib/theme';
import { cn } from '@/lib/cn';

interface FieldErrors {
  username?: string;
  phone?: string;
  email?: string;
}

// Surface the real backend message when it carries one, else a friendly line.
function messageFor(err: unknown, fallback: string): string {
  return err instanceof ApiError ? (err.message !== err.code ? err.message : fallback) : fallback;
}

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, patchUser } = useAuth();
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();

  const initialUsername = user?.username ?? '';
  const initialPhone = user?.phone ?? '';
  const initialEmail = user?.email ?? '';

  const [username, setUsername] = useState(initialUsername);
  const [phone, setPhone] = useState(initialPhone);
  const [email, setEmail] = useState(initialEmail);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  // Synchronous double-tap guards. isPending / disabled only flip on the next
  // render, so two taps in the same tick would both fire a real request.
  const savingRef = useRef(false);
  const uploadingRef = useRef(false);

  const dirty = useMemo(
    () =>
      username.trim() !== initialUsername ||
      phone.trim() !== initialPhone ||
      email.trim() !== initialEmail,
    [username, phone, email, initialUsername, initialPhone, initialEmail],
  );

  const uploading = uploadAvatar.isPending;
  const saving = updateProfile.isPending;
  const canSave = dirty && !saving && !uploading;
  const initial = (username || user?.username || 'P').slice(0, 1).toUpperCase();

  async function pickAvatar() {
    if (uploadingRef.current) return;
    setAvatarError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setAvatarError('Photo permission is needed to change your picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || result.assets.length === 0) return;
    const asset = result.assets[0];
    uploadingRef.current = true;
    try {
      const { avatarUrl: url } = await uploadAvatar.mutateAsync({
        uri: asset.uri,
        name: asset.fileName ?? 'avatar.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      });
      setAvatarUrl(url);
      patchUser({ avatarUrl: url });
    } catch (err) {
      setAvatarError(messageFor(err, 'Could not upload the image. Please try again.'));
    } finally {
      uploadingRef.current = false;
    }
  }

  async function onSave() {
    if (savingRef.current) return;
    setSubmitError(null);

    const u = username.trim();
    const p = phone.trim();
    const e = email.trim();

    // Client-side validation for the fields the player actually changed.
    const errs: FieldErrors = {};
    if (u !== initialUsername && !/^[a-zA-Z0-9_.]{3,30}$/.test(u)) {
      errs.username = 'Use 3-30 letters, numbers, dot or underscore.';
    }
    if (p !== initialPhone && !/^0?1\d{9}$/.test(p)) {
      errs.phone = 'Enter a valid Bangladeshi mobile number.';
    }
    if (e !== initialEmail && e.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      errs.email = 'Enter a valid email address.';
    }
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    // Send only the changed fields. An emptied email is sent as "" to clear it.
    const input: UpdateProfileInput = {};
    if (u !== initialUsername) input.username = u;
    if (p !== initialPhone) input.phone = p;
    if (e !== initialEmail) input.email = e;
    if (Object.keys(input).length === 0) {
      router.back();
      return;
    }

    savingRef.current = true;
    try {
      const updated = await updateProfile.mutateAsync(input);
      patchUser({
        username: updated.username,
        phone: updated.phone,
        email: updated.email,
        avatarUrl: updated.avatarUrl,
        language: updated.language,
      });
      router.back();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'USERNAME_TAKEN') {
          setFieldErrors({ username: messageFor(err, 'That username is already taken.') });
        } else if (err.code === 'PHONE_TAKEN') {
          setFieldErrors({ phone: messageFor(err, 'That phone number is already in use.') });
        } else if (err.code === 'EMAIL_TAKEN') {
          setFieldErrors({ email: messageFor(err, 'That email is already in use.') });
        } else {
          setSubmitError(messageFor(err, 'Could not save your changes. Please try again.'));
        }
      } else {
        setSubmitError('Could not save your changes. Please try again.');
      }
    } finally {
      savingRef.current = false;
    }
  }

  return (
    <Screen
      header={<StackScreenHeader title="Personal info" subtitle="Edit your profile details" />}
      contentClassName="px-4 pt-5 gap-5"
      footer={
        <View className="border-t border-divider bg-paper px-4 pb-7 pt-3">
          {submitError ? (
            <View className="mb-2 flex-row items-start gap-2 rounded-xl border border-hot/30 bg-hot/10 px-3 py-2">
              <Ionicons name="alert-circle" size={16} color={colors.hot} />
              <Text className="flex-1 text-xs font-medium text-hot">{submitError}</Text>
            </View>
          ) : null}
          <PrimaryButton
            label={saving ? 'Saving...' : 'Save changes'}
            icon="checkmark-circle"
            fullWidth
            disabled={!canSave}
            loading={saving}
            onPress={onSave}
          />
        </View>
      }
    >
      {/* Avatar */}
      <View className="items-center gap-3">
        <Pressable onPress={pickAvatar} disabled={uploading} className="active:opacity-80">
          <View className="relative h-24 w-24 overflow-hidden rounded-3xl border-2 border-gold-500/50 bg-surfaceAlt">
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View className="h-full w-full items-center justify-center">
                <Text className="text-3xl font-black text-ink-soft">{initial}</Text>
              </View>
            )}
            <View className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full border-2 border-paper bg-gold-500">
              <Ionicons name={uploading ? 'hourglass' : 'camera'} size={15} color={colors.ink} />
            </View>
          </View>
        </Pressable>
        <Pressable onPress={pickAvatar} disabled={uploading} hitSlop={6}>
          <Text className="text-sm font-bold text-gold-700">
            {uploading ? 'Uploading...' : 'Change photo'}
          </Text>
        </Pressable>
        {avatarError ? (
          <Text className="text-center text-[11px] font-medium text-hot">{avatarError}</Text>
        ) : null}
      </View>

      {/* Fields */}
      <View className="gap-4">
        <TextField
          label="Username"
          value={username}
          onChangeText={(t) => {
            setUsername(t);
            if (fieldErrors.username) setFieldErrors((p) => ({ ...p, username: undefined }));
          }}
          placeholder="your_username"
          icon="person-outline"
          error={fieldErrors.username}
          helper="3-30 characters: letters, numbers, dot or underscore"
        />
        <TextField
          label="Phone number"
          value={phone}
          onChangeText={(t) => {
            setPhone(t);
            if (fieldErrors.phone) setFieldErrors((p) => ({ ...p, phone: undefined }));
          }}
          placeholder="01XXXXXXXXX"
          icon="call-outline"
          keyboardType="phone-pad"
          error={fieldErrors.phone}
        />
        <TextField
          label="Email (optional)"
          value={email}
          onChangeText={(t) => {
            setEmail(t);
            if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }));
          }}
          placeholder="you@example.com"
          icon="mail-outline"
          keyboardType="email-address"
          error={fieldErrors.email}
          helper="Leave empty to remove your email"
        />
      </View>

      <View className="flex-row items-center gap-2 rounded-xl border border-divider bg-paper px-3 py-2.5">
        <Ionicons name="shield-checkmark-outline" size={16} color={colors.inkMute} />
        <Text className={cn('flex-1 text-[11px]', 'text-ink-mute')}>
          Your details are used to secure your account and process withdrawals.
        </Text>
      </View>
    </Screen>
  );
}
