// Built by Anointed Coder.
//
// Premium casino-style spin wheel. SVG-based so it scales cleanly on
// mobile and avoids canvas perf hits. The wheel is driven by a parent
// `landingIndex` prop (server-selected segment). When `spinning`
// flips true, the rotation transitions via CSS for ~4.5s landing on
// the wedge centre, then fires `onLandingComplete`.

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLang } from '@/lib/i18n/context';
import { cn } from '@/lib/utils/cn';

export interface SpinWheelSegment {
  id: string;
  label: string;
  color: string;
  payoutType?: string;
  payoutAmount?: number;
}

export interface SpinWheelProps {
  segments: SpinWheelSegment[];
  spinning: boolean;
  landingIndex: number | null;
  onLandingComplete?: () => void;
  size?: number;
  centerLabel?: string;
  disabled?: boolean;
  onSpinClick?: () => void;
}

const BULB_COUNT = 24;
const FULL_TURNS = 6;

// Polar -> Cartesian.
function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// SVG arc path for a wedge.
function wedgePath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polar(cx, cy, r, endDeg);
  const end = polar(cx, cy, r, startDeg);
  const largeArc = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

export function SpinWheel({ segments, spinning, landingIndex, onLandingComplete, size = 320, centerLabel, disabled, onSpinClick }: SpinWheelProps) {
  const { lang } = useLang();
  const bn = lang === 'bn';

  const sliceDeg = segments.length > 0 ? 360 / segments.length : 0;
  const center = size / 2;
  const wheelR = center - 22;
  const innerR = wheelR - 14;
  const bulbR = center - 8;
  const labelR = wheelR * 0.62;

  const [rotation, setRotation] = useState(0);
  // Respect the user's OS-level reduced-motion preference. When set
  // we keep the wheel functional but skip the long 4.6s spin
  // transition - the wheel snaps to the landing wedge and we fire
  // onLandingComplete on the next frame. This protects users with
  // motion sensitivity from a forced animation while preserving the
  // game outcome semantics.
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Compute target rotation whenever the parent sets landingIndex +
  // flips spinning to true. We layer FULL_TURNS extra spins on top so
  // the wheel rotates for a couple of seconds before landing on the
  // wedge centre. The pointer sits at 12 o'clock so the target wedge
  // centre angle from the top is (landingIndex * sliceDeg + sliceDeg/2).
  // We rotate the wheel CCW by that amount so that wedge ends up under
  // the pointer.
  useEffect(() => {
    if (spinning && landingIndex != null && segments.length > 0) {
      const wedgeCentre = landingIndex * sliceDeg + sliceDeg / 2;
      // Final rotation = previous full revolutions baseline + extra
      // FULL_TURNS + alignment offset. We always add to the existing
      // rotation so the wheel only ever turns forward.
      const target = Math.ceil(rotation / 360) * 360 + FULL_TURNS * 360 + (360 - wedgeCentre);
      setRotation(target);
      if (reducedMotion && onLandingComplete) {
        // No CSS transition to wait on - fire the landing callback
        // on the next frame so the parent's state machine still
        // sees the spin -> result sequence in order.
        const id = window.setTimeout(() => onLandingComplete(), 50);
        return () => window.clearTimeout(id);
      }
    }
  }, [spinning, landingIndex, segments.length, sliceDeg, reducedMotion]); // eslint-disable-line react-hooks/exhaustive-deps

  const bulbs = useMemo(() => {
    const arr: Array<{ cx: number; cy: number; delay: number }> = [];
    for (let i = 0; i < BULB_COUNT; i += 1) {
      const angle = (i / BULB_COUNT) * 360;
      const p = polar(center, center, bulbR, angle);
      arr.push({ cx: p.x, cy: p.y, delay: (i % 6) * 150 });
    }
    return arr;
  }, [center, bulbR]);

  const empty = segments.length === 0;

  return (
    <div
      className="relative inline-block select-none"
      style={{ width: size, height: size }}
      aria-label={bn ? 'লাকি স্পিন হুইল' : 'Lucky spin wheel'}
      aria-busy={spinning}
    >
      {/* Outer metallic gold rim */}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0" aria-hidden>
        <defs>
          <radialGradient id="rim-gradient" cx="50%" cy="50%" r="50%">
            <stop offset="80%" stopColor="#7A4F00" />
            <stop offset="90%" stopColor="#F5B400" />
            <stop offset="100%" stopColor="#3A1F00" />
          </radialGradient>
          <radialGradient id="hub-gradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFE066" />
            <stop offset="60%" stopColor="#F5B400" />
            <stop offset="100%" stopColor="#7A4F00" />
          </radialGradient>
          <filter id="wheel-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#000" floodOpacity="0.35" />
          </filter>
        </defs>
        <circle cx={center} cy={center} r={center - 4} fill="url(#rim-gradient)" filter="url(#wheel-shadow)" />
        {bulbs.map((b, i) => (
          <circle
            key={i}
            cx={b.cx}
            cy={b.cy}
            r={4}
            fill={i % 2 === 0 ? '#FFE9A8' : '#FFFFFF'}
            style={{ animation: `pasha9-bulb-pulse 1.4s ease-in-out ${b.delay}ms infinite` }}
          />
        ))}
      </svg>

      {/* Rotating wheel body */}
      <div
        className="absolute"
        style={{
          left: 22,
          top: 22,
          width: size - 44,
          height: size - 44,
          transform: `rotate(${rotation}deg)`,
          transition: spinning && !reducedMotion
            ? 'transform 4.6s cubic-bezier(0.17, 0.67, 0.32, 1)'
            : 'none',
          willChange: 'transform',
        }}
        onTransitionEnd={() => {
          if (spinning && onLandingComplete) onLandingComplete();
        }}
      >
        <svg width={size - 44} height={size - 44} viewBox={`0 0 ${size - 44} ${size - 44}`} aria-hidden>
          {empty ? (
            <circle cx={(size - 44) / 2} cy={(size - 44) / 2} r={(size - 44) / 2 - 4} fill="#1F2937" />
          ) : (
            segments.map((s, i) => {
              const cx = (size - 44) / 2;
              const cy = (size - 44) / 2;
              const r = cx - 4;
              const startDeg = i * sliceDeg;
              const endDeg = startDeg + sliceDeg;
              const path = wedgePath(cx, cy, r, startDeg, endDeg);
              const labelP = polar(cx, cy, labelR * ((size - 44) / size), startDeg + sliceDeg / 2);
              return (
                <g key={s.id}>
                  <path d={path} fill={s.color} stroke="rgba(0,0,0,0.18)" strokeWidth={1.2} />
                  <g
                    transform={`rotate(${startDeg + sliceDeg / 2} ${labelP.x} ${labelP.y})`}
                  >
                    <text
                      x={labelP.x}
                      y={labelP.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontWeight={800}
                      fontSize={Math.max(11, Math.min(15, (size - 44) / 22))}
                      fill="#FFFFFF"
                      style={{ textShadow: '0 1px 2px rgba(0,0,0,0.55)' }}
                    >
                      {s.label}
                    </text>
                  </g>
                </g>
              );
            })
          )}
          <circle cx={(size - 44) / 2} cy={(size - 44) / 2} r={innerR / 4} fill="url(#hub-gradient)" stroke="#7A4F00" strokeWidth={2} />
        </svg>
      </div>

      {/* Crimson pointer at top centre */}
      <svg
        width={36}
        height={42}
        viewBox="0 0 36 42"
        className="absolute z-10"
        style={{ left: center - 18, top: -6 }}
        aria-hidden
      >
        <defs>
          <linearGradient id="pointer-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF5A5A" />
            <stop offset="100%" stopColor="#8B0000" />
          </linearGradient>
        </defs>
        <polygon points="18,40 4,4 32,4" fill="url(#pointer-gradient)" stroke="#3A0000" strokeWidth={1.5} />
        <circle cx={18} cy={10} r={5} fill="#FFD2D2" stroke="#8B0000" strokeWidth={1} />
      </svg>

      {/* Center SPIN button */}
      <button
        type="button"
        onClick={onSpinClick}
        disabled={disabled || empty || spinning}
        className={cn(
          'absolute z-10 inline-flex items-center justify-center rounded-full border-2 border-amber-700 bg-gradient-to-b from-amber-300 to-amber-500 font-extrabold uppercase tracking-wider text-[#3A1F00] shadow-[inset_0_2px_0_rgba(255,255,255,0.55),0_8px_18px_-6px_rgba(245,180,0,0.7)] transition',
          disabled || empty || spinning ? 'cursor-not-allowed opacity-80' : 'hover:brightness-110 active:scale-95',
        )}
        style={{
          left: center - 44,
          top: center - 44,
          width: 88,
          height: 88,
        }}
        aria-label={bn ? 'স্পিন' : 'Spin'}
      >
        <span className="text-sm leading-none">
          {centerLabel ?? (bn ? 'স্পিন' : 'SPIN')}
        </span>
      </button>

      <style jsx>{`
        @keyframes pasha9-bulb-pulse {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
