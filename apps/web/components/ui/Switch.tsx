'use client';

import { cn } from '@/lib/utils/cn';

type Tone = 'brand' | 'danger';

export function Switch({
  checked,
  onChange,
  label,
  disabled,
  tone = 'brand',
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
  tone?: Tone;
}) {
  const activeTrack =
    tone === 'danger'
      ? 'border-amber-500/70 bg-amber-500'
      : 'border-brand-yellow-600 bg-brand-yellow-500';
  const inactiveTrack = 'border-brand-divider bg-brand-surface';
  const thumb =
    tone === 'danger' && checked
      ? 'bg-white'
      : checked
        ? 'bg-brand-ink'
        : 'bg-white border border-brand-divider';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition outline-none',
        'focus-visible:ring-2 focus-visible:ring-brand-blue-500/40 focus-visible:ring-offset-1',
        checked ? activeTrack : inactiveTrack,
        disabled && 'pointer-events-none opacity-50',
      )}
      title={label}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-5 w-5 rounded-full shadow transition',
          thumb,
          checked ? 'translate-x-5' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}
