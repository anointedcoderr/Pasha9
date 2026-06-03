// Built by Anointed Coder.
//
// Babu88-style payment method icon picker. Renders a grid of clickable
// tiles, one per active payment method. The selected tile gets a
// yellow border + soft yellow background. Falls back to a coloured
// monogram when the method has no iconUrl set on the admin side, so a
// freshly seeded row still renders cleanly.
//
// The component is presentational - the parent owns the form value.

'use client';

import { cn } from '@/lib/utils/cn';

export interface PickerMethod {
  id: string;
  name: string;
  type?: string | null;
  iconUrl?: string | null;
}

interface Props {
  methods: PickerMethod[];
  selectedName: string;
  onSelect: (name: string) => void;
  emptyLabel?: string;
}

// Brand-colour fallbacks so an admin who hasn't uploaded an icon yet
// still gets a legible tile that matches the public payment-method
// strip elsewhere on the site.
function fallbackColours(name: string): { bg: string; fg: string } {
  const n = name.toLowerCase();
  if (n.includes('bkash')) return { bg: '#E2136E', fg: '#FFFFFF' };
  if (n.includes('nagad')) return { bg: '#EE2A24', fg: '#FFFFFF' };
  if (n.includes('rocket')) return { bg: '#8B3793', fg: '#FFFFFF' };
  if (n.includes('upay')) return { bg: '#13C2C2', fg: '#FFFFFF' };
  if (n.includes('binance')) return { bg: '#F3BA2F', fg: '#1E1E1E' };
  if (n.includes('usdt') || n.includes('tether')) return { bg: '#26A17B', fg: '#FFFFFF' };
  return { bg: '#1F2937', fg: '#FCD34D' };
}

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase().slice(0, 2);
}

export function PaymentMethodPicker({ methods, selectedName, onSelect, emptyLabel }: Props) {
  if (methods.length === 0) {
    return <p className="text-sm text-brand-inkMute">{emptyLabel ?? 'No active methods.'}</p>;
  }
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
      {methods.map((m) => {
        const active = m.name === selectedName;
        const colours = fallbackColours(m.name);
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelect(m.name)}
            aria-pressed={active}
            aria-label={m.name}
            className={cn(
              'group flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border-2 bg-brand-paper p-2 shadow-sm transition',
              active
                ? 'border-brand-yellow-500 bg-brand-yellow-500/10 shadow-[0_8px_24px_-12px_rgba(245,180,0,0.6)]'
                : 'border-brand-divider hover:border-brand-yellow-500/60',
            )}
          >
            {m.iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.iconUrl} alt="" className="h-10 w-10 object-contain" />
            ) : (
              <span
                aria-hidden
                className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-extrabold"
                style={{ background: colours.bg, color: colours.fg }}
              >
                {initials(m.name)}
              </span>
            )}
            <span className={cn('truncate text-[11px] font-semibold', active ? 'text-brand-ink' : 'text-brand-inkSoft')}>{m.name}</span>
          </button>
        );
      })}
    </div>
  );
}
