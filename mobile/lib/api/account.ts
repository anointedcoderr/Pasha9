// Built by Anointed Coder.
//
// Account + notifications API surface, wired to the live Pasha9 endpoints.
// Typed request helpers plus the colocated react-query hooks the account
// screens use:
//   - profile edit    PATCH /api/me/profile
//   - avatar upload    POST  /api/me/avatar   (multipart, field "file")
//   - password change  POST  /api/me/password
//   - notifications    GET   /api/me/notifications
//   - mark read        POST  /api/me/notifications/read  ({ recipientId } | { all })
//
// Reads are gated on the authed session exactly like lib/api/hooks.ts gates the
// wallet reads, so a signed-out shell never fires an unauthorised request and
// the bell poll only runs while a live session exists.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { useAuth } from '@/store/auth';
import type { AuthUser } from './auth';

// The base AuthUser (login / register / me) does not carry these, but the
// profile endpoints return and accept them. Add them here (optional) via module
// augmentation so patchUser and the account screens can read / merge them
// without editing the shared auth module.
declare module './auth' {
  interface AuthUser {
    email?: string | null;
    language?: string | null;
    country?: string | null;
  }
}

// ---------------------------------------------------------------------------
// Profile update (PATCH /api/me/profile)
// ---------------------------------------------------------------------------

/** Only the changed fields are sent. An empty `email` string clears it. */
export interface UpdateProfileInput {
  username?: string;
  phone?: string;
  email?: string;
  language?: 'bn' | 'en';
  avatarUrl?: string;
}

/** The user object the profile endpoint returns after a successful update. */
export interface UpdatedProfile {
  id: string;
  username: string;
  phone: string;
  email: string | null;
  language: string | null;
  avatarUrl: string | null;
  country: string | null;
}

export async function updateProfile(input: UpdateProfileInput): Promise<UpdatedProfile> {
  const res = await api.patch<{ ok: true; user: UpdatedProfile }>('/api/me/profile', input);
  return res.user;
}

export function useUpdateProfile() {
  return useMutation<UpdatedProfile, unknown, UpdateProfileInput>({
    mutationFn: updateProfile,
  });
}

// ---------------------------------------------------------------------------
// Avatar upload (POST /api/me/avatar)
// ---------------------------------------------------------------------------

/** A picked image asset. On RN a FormData file part is the { uri, name, type } triple. */
export interface AvatarAsset {
  uri: string;
  name: string;
  type: string;
}

export async function uploadAvatar(asset: AvatarAsset): Promise<{ avatarUrl: string }> {
  const form = new FormData();
  // React Native's FormData accepts the { uri, name, type } shape for a file
  // part; the DOM typings do not, hence the cast.
  form.append('file', { uri: asset.uri, name: asset.name, type: asset.type } as unknown as Blob);
  const res = await api.upload<{ ok: true; avatarUrl: string }>('/api/me/avatar', form);
  return { avatarUrl: res.avatarUrl };
}

export function useUploadAvatar() {
  return useMutation<{ avatarUrl: string }, unknown, AvatarAsset>({
    mutationFn: uploadAvatar,
  });
}

// ---------------------------------------------------------------------------
// Password change (POST /api/me/password)
// ---------------------------------------------------------------------------

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export async function changePassword(input: ChangePasswordInput): Promise<void> {
  await api.post<{ ok: true; changed: true }>('/api/me/password', input);
}

export function useChangePassword() {
  return useMutation<void, unknown, ChangePasswordInput>({
    mutationFn: changePassword,
  });
}

// ---------------------------------------------------------------------------
// Notifications (GET /api/me/notifications, POST .../read)
// ---------------------------------------------------------------------------

/** One in-app notification. Bilingual title / body; readAt null means unread. */
export interface AppNotification {
  recipientId: string;
  id: string;
  titleEn: string;
  titleBn: string;
  bodyEn: string;
  bodyBn: string;
  linkUrl: string | null;
  imageUrl: string | null;
  soundUrl: string | null;
  priority: string;
  kind: string;
  readAt: string | null;
  deliveredAt: string;
  createdAt: string;
}

export interface NotificationsResult {
  unreadCount: number;
  notifications: AppNotification[];
}

export const notificationsQueryKey = ['me', 'notifications'] as const;

export async function getNotifications(): Promise<NotificationsResult> {
  const res = await api.get<{
    ok: true;
    unreadCount: number;
    notifications: AppNotification[];
  }>('/api/me/notifications');
  return {
    unreadCount: typeof res.unreadCount === 'number' ? res.unreadCount : 0,
    notifications: res.notifications ?? [],
  };
}

/**
 * The player's notifications, newest first. Gated on the authed session and
 * polled every 60s so the bell badge stays fresh without a manual refresh; the
 * poll is disabled while signed out so a guest shell never hits the endpoint.
 */
export function useNotifications() {
  const { status } = useAuth();
  const authed = status === 'authed';
  return useQuery<NotificationsResult>({
    queryKey: notificationsQueryKey,
    queryFn: getNotifications,
    enabled: authed,
    refetchInterval: authed ? 60_000 : false,
    staleTime: 30_000,
  });
}

export async function markNotificationRead(recipientId: string): Promise<void> {
  await api.post<{ ok: true }>('/api/me/notifications/read', { recipientId });
}

/** Mark one notification read; on success refresh the list + unread count. */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation<void, unknown, string>({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationsQueryKey }),
  });
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post<{ ok: true }>('/api/me/notifications/read', { all: true });
}

/** Mark every notification read; on success refresh the list + unread count. */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation<void, unknown, void>({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationsQueryKey }),
  });
}
