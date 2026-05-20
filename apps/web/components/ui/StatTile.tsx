import { type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export function StatTile({
  label,
  value,
  hint,
  icon,
  accent = 'neon',
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  accent?: 'neon' | 'gold' | 'mixed';
  className?: string;
}) {
  const accentMap = {
    neon: 'from-neon/15 to-transparent',
    gold: 'from-gold-500/15 to-transparent',
    mixed: 'from-neon/10 via-gold-500/8 to-transparent',
  } as const;
  return (
    <div className={cn('card-glow p-5 md:p-6', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-lo">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-ink-hi tabular-nums">{value}</p>
          {hint ? <p className="mt-1 text-xs text-ink-lo">{hint}</p> : null}
        </div>
        {icon ? (
          <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl border border-neon/15 bg-gradient-to-br', accentMap[accent])}>
            {icon}
          </div>
        ) : null}
      </div>
    </div>
  );
}
