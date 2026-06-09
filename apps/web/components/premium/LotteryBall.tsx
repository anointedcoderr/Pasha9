// Built by Anointed Coder.
//
// Single lottery ball with the winning digit overlaid. Uses the
// uploaded 3D render when available, otherwise a hand-authored SVG
// sphere. The digit is always rendered as text on top so the same
// component renders 0-9 regardless of asset state.

'use client';

import { useAsset } from '@/lib/atelier/client';
import { cn } from '@/lib/utils/cn';

type BallColor = 'gold' | 'silver' | 'bronze' | 'emerald';

const SLOT: Record<BallColor, string> = {
  gold: 'lotto_ball_gold',
  silver: 'lotto_ball_silver',
  bronze: 'lotto_ball_bronze',
  emerald: 'lotto_ball_emerald',
};

const STOPS: Record<BallColor, { from: string; mid: string; to: string; rim: string; digit: string }> = {
  gold: { from: '#fff0bd', mid: '#d6a847', to: '#7a4f00', rim: '#3a1f00', digit: '#3a1f00' },
  silver: { from: '#fafafa', mid: '#c0c4cc', to: '#5a6068', rim: '#202428', digit: '#1a1d24' },
  bronze: { from: '#f0c388', mid: '#8c6a3c', to: '#3a2410', rim: '#1a0f06', digit: '#1a0f06' },
  emerald: { from: '#a8f1c8', mid: '#2f7a52', to: '#0e3a25', rim: '#04130a', digit: '#04130a' },
};

interface Props {
  color: BallColor;
  digit?: string;
  size?: number;
  className?: string;
  /** Optional inline style passthrough for animation positioning. */
  style?: React.CSSProperties;
}

export function LotteryBall({ color, digit, size = 56, className, style }: Props) {
  const url = useAsset(SLOT[color]);
  const stops = STOPS[color];

  return (
    <span
      className={cn('relative inline-block select-none', className)}
      style={{ width: size, height: size, ...style }}
      aria-label={digit ? `Ball ${digit}` : `Ball ${color}`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-contain"
        />
      ) : (
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
          <defs>
            <radialGradient id={`pa-ball-${color}-body`} cx="40%" cy="30%" r="80%">
              <stop offset="0%" stopColor={stops.from} />
              <stop offset="55%" stopColor={stops.mid} />
              <stop offset="100%" stopColor={stops.to} />
            </radialGradient>
            <radialGradient id={`pa-ball-${color}-shine`} cx="32%" cy="22%" r="22%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.85)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
          </defs>
          <circle cx={50} cy={50} r={47} fill={`url(#pa-ball-${color}-body)`} stroke={stops.rim} strokeWidth={1} />
          <circle cx={50} cy={50} r={30} fill="rgba(255,255,255,0.18)" />
          <circle cx={50} cy={50} r={28} fill={stops.from} opacity={0.65} />
          <ellipse cx={36} cy={28} rx={16} ry={10} fill={`url(#pa-ball-${color}-shine)`} />
        </svg>
      )}
      {digit ? (
        <span
          className="pa-display absolute inset-0 flex items-center justify-center text-2xl font-black"
          style={{ color: stops.digit, textShadow: '0 1px 0 rgba(255,255,255,0.4)', fontSize: Math.max(14, size * 0.42) }}
        >
          {digit}
        </span>
      ) : null}
    </span>
  );
}
