import { type ReactNode } from 'react';
import { Check, Clock, X, Circle, Dot } from 'lucide-react';
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
  const tone = map[status] ?? 'neutral';
  const cueIcon: Record<Tone, ReactNode> = {
    ok: <Check aria-hidden className="h-3 w-3" strokeWidth={3} />,
    warn: <Clock aria-hidden className="h-3 w-3" />,
    danger: <X aria-hidden className="h-3 w-3" strokeWidth={3} />,
    info: <Dot aria-hidden className="h-3 w-3" strokeWidth={6} />,
    gold: <Circle aria-hidden className="h-3 w-3" />,
    neutral: <Circle aria-hidden className="h-2.5 w-2.5" />,
  };
  return <Chip tone={tone} icon={cueIcon[tone]}>{status}</Chip>;
}
