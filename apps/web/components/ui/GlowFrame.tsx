import { type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export function GlowFrame({ children, className, intensity = 'soft' }: { children: ReactNode; className?: string; intensity?: 'soft' | 'medium' | 'strong' }) {
  const map = {
    soft: 'shadow-glow',
    medium: 'shadow-glow-gold',
    strong: 'shadow-glow-neon',
  } as const;
  return (
    <div className={cn('relative rounded-card', map[intensity], className)}>
      <div aria-hidden className="pointer-events-none absolute inset-0 rounded-card bg-grad-radial-glow" />
      <div className="relative">{children}</div>
    </div>
  );
}
