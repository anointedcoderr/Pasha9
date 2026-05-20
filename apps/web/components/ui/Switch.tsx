'use client';

import { cn } from '@/lib/utils/cn';

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition outline-none',
        checked ? 'border-neon/60 bg-neon/30 shadow-glow-neon' : 'border-neon/15 bg-base-elev',
        disabled && 'opacity-50 pointer-events-none',
      )}
      title={label}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-5 w-5 rounded-full bg-ink-hi transition',
          checked ? 'translate-x-5' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}
