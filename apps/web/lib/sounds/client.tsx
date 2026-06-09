// Built by Anointed Coder.
//
// Sound playback context for the premium Spin and Lotto pages.
//
// Three layers of consent before a sound plays:
//   1. Admin master toggle (sounds_enabled in SystemSetting)
//   2. User mute preference (localStorage pasha9:sounds_muted)
//   3. Browser autoplay policy (requires user gesture)
//
// Every sound also no-ops when prefers-reduced-motion is set, so
// motion-sensitive users (who often also dislike sudden audio) are
// covered without needing a separate setting.

'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

const STORAGE_MUTED = 'pasha9:sounds_muted';
const STORAGE_GESTURE = 'pasha9:sounds_gesture';
const STORAGE_NOTIF_SOUND = 'pasha9:notif_sound_enabled';

interface SoundMap {
  enabled: boolean;
  defaultVolume: number;
  sounds: Record<string, string | null>;
}

interface SoundContextValue {
  map: SoundMap | null;
  userMuted: boolean;
  setUserMuted: (muted: boolean) => void;
  /**
   * Separate preference for the new-in-app-notification chime. Stays
   * independent of the global mute so a player can keep the premium
   * Spin/Lotto sounds off while still hearing the notification ring,
   * or vice versa. Mirrors the client product spec ("Notification
   * Sound Disabled - user still receives, but no sound").
   */
  notifSoundEnabled: boolean;
  setNotifSoundEnabled: (enabled: boolean) => void;
  /** Resolves the URL to play for an incoming notification.
   *  Per-message soundUrl wins; otherwise the global ringtone slot. */
  resolveNotificationSound: (perMessageUrl: string | null | undefined) => string | null;
  /** Plays a one-shot URL respecting notifSoundEnabled and reduced
   *  motion. Used by the NotificationDrawer for the per-message
   *  chime; the slot-based play() helper is for premium UI sounds. */
  playNotificationSound: (url: string | null) => Promise<void>;
  play: (slotId: string, opts?: { volume?: number; loop?: boolean }) => Promise<void>;
  stop: (slotId: string) => void;
  /** True if every gate is passing and playback would actually happen. */
  canPlay: boolean;
  reduced: boolean;
}

const SoundContext = createContext<SoundContextValue | null>(null);

export function SoundProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<SoundMap | null>(null);
  const [userMuted, setUserMutedState] = useState<boolean>(true); // default muted before gesture
  // Notification sound defaults ON. Notifications are an explicit
  // user-requested channel (they granted permission), so the chime
  // is expected behaviour unless they opt out.
  const [notifSoundEnabled, setNotifSoundEnabledState] = useState<boolean>(true);
  const [reduced, setReduced] = useState<boolean>(false);
  const audiosRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const notifAudioRef = useRef<HTMLAudioElement | null>(null);
  const gestureSeenRef = useRef<boolean>(false);

  // Load preferences once on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(STORAGE_MUTED);
      // Default: muted = true until the user opts in. This matches
      // every modern browser autoplay policy and stops surprise
      // audio on the first page load.
      if (stored === '0') setUserMutedState(false);
      const notifStored = window.localStorage.getItem(STORAGE_NOTIF_SOUND);
      if (notifStored === '0') setNotifSoundEnabledState(false);
      gestureSeenRef.current = window.localStorage.getItem(STORAGE_GESTURE) === '1';
    } catch { /* swallow */ }
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      setReduced(mq.matches);
      const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, []);

  // Fetch the sound map once.
  useEffect(() => {
    let alive = true;
    fetch('/api/content/site-sounds', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive || !j) return;
        setMap({
          enabled: !!j.enabled,
          defaultVolume: typeof j.defaultVolume === 'number' ? j.defaultVolume : 0.7,
          sounds: (j.sounds ?? {}) as Record<string, string | null>,
        });
      })
      .catch(() => { /* leave null - hook treats it as disabled */ });
    return () => { alive = false; };
  }, []);

  // Mark gesture once the user has interacted at least once. After
  // that, audio.play() is allowed by every browser.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mark = () => {
      if (gestureSeenRef.current) return;
      gestureSeenRef.current = true;
      try { window.localStorage.setItem(STORAGE_GESTURE, '1'); } catch { /* swallow */ }
    };
    window.addEventListener('pointerdown', mark, { once: true });
    window.addEventListener('keydown', mark, { once: true });
    return () => {
      window.removeEventListener('pointerdown', mark);
      window.removeEventListener('keydown', mark);
    };
  }, []);

  const setUserMuted = useCallback((muted: boolean) => {
    setUserMutedState(muted);
    try { window.localStorage.setItem(STORAGE_MUTED, muted ? '1' : '0'); } catch { /* swallow */ }
  }, []);

  const setNotifSoundEnabled = useCallback((enabled: boolean) => {
    setNotifSoundEnabledState(enabled);
    try { window.localStorage.setItem(STORAGE_NOTIF_SOUND, enabled ? '1' : '0'); } catch { /* swallow */ }
  }, []);

  const resolveNotificationSound = useCallback(
    (perMessageUrl: string | null | undefined): string | null => {
      if (perMessageUrl && perMessageUrl.trim()) return perMessageUrl;
      return (map?.sounds?.notification_ring ?? null) || null;
    },
    [map],
  );

  const playNotificationSound = useCallback(async (url: string | null) => {
    if (!url) return;
    if (!notifSoundEnabled) return;
    if (reduced) return;
    try {
      if (notifAudioRef.current) {
        notifAudioRef.current.pause();
        notifAudioRef.current.src = '';
      }
      const audio = new Audio(url);
      audio.volume = Math.max(0, Math.min(1, map?.defaultVolume ?? 0.8));
      notifAudioRef.current = audio;
      await audio.play();
    } catch { /* autoplay blocked / network blip */ }
  }, [notifSoundEnabled, reduced, map]);

  const ensureAudio = useCallback((slotId: string, url: string): HTMLAudioElement => {
    const cached = audiosRef.current.get(slotId);
    if (cached && cached.src === url) return cached;
    if (cached) { cached.pause(); cached.src = ''; }
    const audio = new Audio(url);
    audio.preload = 'auto';
    audiosRef.current.set(slotId, audio);
    return audio;
  }, []);

  const canPlay = !!map && map.enabled && !userMuted && !reduced;

  const play = useCallback(async (slotId: string, opts?: { volume?: number; loop?: boolean }) => {
    if (!canPlay || !map) return;
    const url = map.sounds[slotId];
    if (!url) return;
    try {
      const audio = ensureAudio(slotId, url);
      audio.loop = opts?.loop === true;
      audio.volume = Math.max(0, Math.min(1, opts?.volume ?? map.defaultVolume));
      audio.currentTime = 0;
      await audio.play();
    } catch { /* autoplay blocked / network blip; silent fallback */ }
  }, [canPlay, map, ensureAudio]);

  const stop = useCallback((slotId: string) => {
    const audio = audiosRef.current.get(slotId);
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  }, []);

  const value = useMemo<SoundContextValue>(() => ({
    map,
    userMuted, setUserMuted,
    notifSoundEnabled, setNotifSoundEnabled,
    resolveNotificationSound, playNotificationSound,
    play, stop, canPlay, reduced,
  }), [map, userMuted, setUserMuted, notifSoundEnabled, setNotifSoundEnabled, resolveNotificationSound, playNotificationSound, play, stop, canPlay, reduced]);

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export function useSound(slotId: string) {
  const ctx = useContext(SoundContext);
  const play = useCallback((opts?: { volume?: number; loop?: boolean }) => {
    if (!ctx) return;
    void ctx.play(slotId, opts);
  }, [ctx, slotId]);
  const stop = useCallback(() => { ctx?.stop(slotId); }, [ctx, slotId]);
  return { play, stop, canPlay: ctx?.canPlay === true };
}

export function useSoundContext() {
  return useContext(SoundContext);
}
