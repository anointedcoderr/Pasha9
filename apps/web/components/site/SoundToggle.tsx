// Built by Anointed Coder.
//
// Header sound toggle. Three visual states:
//   - Off (admin disabled site-wide): icon dimmed, non-interactive
//   - Muted (user opted out): VolumeX
//   - On: Volume2

'use client';

import { Volume2, VolumeX, VolumeOff } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';
import { useSoundContext } from '@/lib/sounds/client';
import { cn } from '@/lib/utils/cn';

interface Props {
  /** Visual variant. "compact" matches the header pill height. */
  variant?: 'compact' | 'default';
  /** Optional className passthrough. */
  className?: string;
}

export function SoundToggle({ variant = 'compact', className }: Props) {
  const ctx = useSoundContext();
  const { lang } = useLang();
  const bn = lang === 'bn';

  if (!ctx) return null;
  const adminDisabled = ctx.map ? !ctx.map.enabled : false;
  const userMuted = ctx.userMuted;

  const onClick = () => {
    if (adminDisabled) return;
    ctx.setUserMuted(!userMuted);
  };

  const ariaLabel = adminDisabled
    ? (bn ? 'সাইট সাউন্ড অ্যাডমিন কর্তৃক বন্ধ' : 'Site sounds disabled by admin')
    : userMuted
      ? (bn ? 'সাউন্ড চালু করুন' : 'Turn sounds on')
      : (bn ? 'সাউন্ড বন্ধ করুন' : 'Turn sounds off');

  const Icon = adminDisabled ? VolumeOff : userMuted ? VolumeX : Volume2;
  const sizeClass = variant === 'compact' ? 'h-10 w-10' : 'h-11 w-11';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={adminDisabled}
      aria-label={ariaLabel}
      aria-pressed={!userMuted && !adminDisabled}
      title={ariaLabel}
      className={cn(
        'inline-flex items-center justify-center rounded-xl border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500/40',
        adminDisabled
          ? 'border-brand-divider bg-brand-surface text-brand-inkMute opacity-60'
          : userMuted
            ? 'border-brand-divider bg-brand-paper text-brand-inkMute hover:border-brand-yellow-500 hover:bg-brand-surface'
            : 'border-brand-yellow-500/60 bg-brand-yellow-500/10 text-brand-yellow-700 hover:bg-brand-yellow-500/20',
        sizeClass,
        className,
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
