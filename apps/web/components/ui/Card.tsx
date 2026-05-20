import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface Props extends HTMLAttributes<HTMLDivElement> {
  glow?: boolean;
  tone?: 'panel' | 'elev' | 'gold' | 'neon';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function Card({ className, glow = true, tone = 'panel', padding = 'md', children, ...rest }: Props) {
  const tones: Record<NonNullable<Props['tone']>, string> = {
    panel: glow ? 'card-glow' : 'surface',
    elev: 'surface-elev',
    gold: 'card-glow ring-gold-soft',
    neon: 'card-glow ring-neon-soft',
  };

  const paddings: Record<NonNullable<Props['padding']>, string> = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-5 md:p-6',
    lg: 'p-6 md:p-8',
  };

  return (
    <div className={cn(tones[tone], paddings[padding], 'relative', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h3 className="text-base font-semibold text-ink-hi">{title}</h3>
        {subtitle ? <p className="mt-1 text-sm text-ink-lo">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
