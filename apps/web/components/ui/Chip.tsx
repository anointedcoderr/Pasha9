import { type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

type Tone = 'neutral' | 'ok' | 'warn' | 'danger' | 'gold' | 'info';

export function Chip({ children, tone = 'neutral', className, icon }: { children: ReactNode; tone?: Tone; className?: string; icon?: ReactNode }) {
  const tones: Record<Tone, string> = {
    neutral: 'chip',
    ok: 'chip chip-ok',
    warn: 'chip chip-warn',
    danger: 'chip chip-danger',
    gold: 'chip chip-gold',
    info: 'chip border-signal-info/40 bg-signal-info/10 text-signal-info',
  };
  return (
    <span className={cn(tones[tone], className)}>
      {icon}
      <span>{children}</span>
    </span>
  );
}

export function StatusChip({ status }: { status: 'pending' | 'approved' | 'rejected' | 'active' | 'blocked' | 'maintenance' | 'hidden' | 'completed' | 'failed' | 'open' | 'closed' | 'paused' }) {
  const map: Record<string, Tone> = {
    pending: 'warn',
    approved: 'ok',
    completed: 'ok',
    active: 'ok',
    open: 'info',
    rejected: 'danger',
    failed: 'danger',
    blocked: 'danger',
    maintenance: 'warn',
    hidden: 'neutral',
    closed: 'neutral',
    paused: 'warn',
  };
  return <Chip tone={map[status] ?? 'neutral'}>{status}</Chip>;
}
