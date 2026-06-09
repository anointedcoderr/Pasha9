// Built by Anointed Coder.
//
// Tier crest medallion. When a 3D render has been uploaded to
// /admin/atelier we render the operator's image. When not, we fall
// back to a CSS-only SVG crest per tier (jade / ruby / onyx).

'use client';

import { useAsset } from '@/lib/atelier/client';
import { cn } from '@/lib/utils/cn';

type Tier = 'lucky' | 'royal' | 'supreme';

const SLOT: Record<Tier, string> = {
  lucky: 'spin_tier_crest_lucky',
  royal: 'spin_tier_crest_royal',
  supreme: 'spin_tier_crest_supreme',
};

interface Props {
  tier: Tier;
  size?: number;
  className?: string;
}

export function TierCrest({ tier, size = 96, className }: Props) {
  const url = useAsset(SLOT[tier]);

  if (url) {
    return (
      <span
        className={cn('relative inline-block', className)}
        style={{ width: size, height: size }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt=""
          aria-hidden
          className="block h-full w-full object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,0.45)]"
        />
      </span>
    );
  }

  // CSS-only SVG fallback. Hand-authored gradient layers, jewel
  // facets and frame ornament so the empty-slot state still looks
  // expensive.
  return (
    <span
      className={cn('relative inline-block', className)}
      style={{ width: size, height: size }}
    >
      <CrestSvg tier={tier} />
    </span>
  );
}

function CrestSvg({ tier }: { tier: Tier }) {
  const cx = 50;
  const cy = 50;
  const frameId = `pa-crest-frame-${tier}`;
  const gemId = `pa-crest-gem-${tier}`;
  const glowId = `pa-crest-glow-${tier}`;

  const gemStops: Array<{ offset: string; color: string }> = (() => {
    if (tier === 'lucky') return [
      { offset: '0%', color: '#7be0a3' },
      { offset: '55%', color: '#2f7a52' },
      { offset: '100%', color: '#0e3a25' },
    ];
    if (tier === 'royal') return [
      { offset: '0%', color: '#ff7888' },
      { offset: '55%', color: '#8b1a2b' },
      { offset: '100%', color: '#3a0810' },
    ];
    return [
      { offset: '0%', color: '#f5d68a' },
      { offset: '55%', color: '#f0a830' },
      { offset: '100%', color: '#1a1a1f' },
    ];
  })();

  const motif = (() => {
    if (tier === 'lucky') return (
      // bamboo leaves
      <g stroke="#0c2818" strokeWidth={1.4} fill="rgba(12,40,24,0.55)">
        <path d="M50 28 Q56 38 50 50 Q44 38 50 28 Z" />
        <path d="M50 50 Q58 60 50 72 Q42 60 50 50 Z" />
      </g>
    );
    if (tier === 'royal') return (
      // tiny crown + scepters etched in gold
      <g stroke="#fff0bd" strokeWidth={1.4} fill="none" opacity={0.9}>
        <path d="M40 36 L44 30 L50 34 L56 30 L60 36 L58 42 L42 42 Z" fill="#fff0bd" opacity={0.85} />
        <line x1="38" y1="56" x2="62" y2="64" />
        <line x1="62" y1="56" x2="38" y2="64" />
      </g>
    );
    // supreme: sunburst etched into onyx
    return (
      <g stroke="#fff0bd" strokeWidth={0.9} opacity={0.85}>
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((a) => {
          const rad = (a * Math.PI) / 180;
          const r1 = 20;
          const r2 = 32;
          return (
            <line
              key={a}
              x1={cx + Math.cos(rad) * r1}
              y1={cy + Math.sin(rad) * r1}
              x2={cx + Math.cos(rad) * r2}
              y2={cy + Math.sin(rad) * r2}
            />
          );
        })}
      </g>
    );
  })();

  return (
    <svg viewBox="0 0 100 100" className="h-full w-full">
      <defs>
        <radialGradient id={frameId} cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#fff0bd" />
          <stop offset="55%" stopColor="#d6a847" />
          <stop offset="100%" stopColor="#7a4f00" />
        </radialGradient>
        <radialGradient id={gemId} cx="50%" cy="40%" r="60%">
          {gemStops.map((s, i) => (
            <stop key={i} offset={s.offset} stopColor={s.color} />
          ))}
        </radialGradient>
        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={tier === 'lucky' ? '#36ff9a' : tier === 'royal' ? '#ff5a6a' : '#f5d061'} stopOpacity="0.45" />
          <stop offset="100%" stopColor="transparent" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* glow halo */}
      <circle cx={cx} cy={cy} r={50} fill={`url(#${glowId})`} />
      {/* outer gold frame */}
      <circle cx={cx} cy={cy} r={44} fill={`url(#${frameId})`} stroke="#7a4f00" strokeWidth={1.5} />
      {/* inner dark bezel */}
      <circle cx={cx} cy={cy} r={36} fill="#0a0a0d" />
      {/* gem face */}
      <circle cx={cx} cy={cy} r={32} fill={`url(#${gemId})`} stroke="#7a4f00" strokeWidth={1} />
      {/* motif on top of gem */}
      {motif}
      {/* ornament dots at cardinal points */}
      {[0, 90, 180, 270].map((a) => {
        const rad = (a * Math.PI) / 180;
        const x = cx + Math.cos(rad) * 41;
        const y = cy + Math.sin(rad) * 41;
        return <circle key={a} cx={x} cy={y} r={2.5} fill="#fff0bd" stroke="#7a4f00" strokeWidth={0.6} />;
      })}
    </svg>
  );
}
