// Built by Anointed Coder.
//
// Original in-house SVG artwork for the six Pasha Native Games. Pure
// vector + gradient so the cards stay small (no raster assets, no
// network round-trips), scale on every breakpoint and render in
// crisp focus on any DPR.
//
// Every illustration is original work composed of plain SVG
// primitives. No third-party logos, no provider names, no copied
// commercial slot symbols. Glassy 3D feel via layered radial
// gradients + a subtle highlight stripe across the top.

import { type CSSProperties } from 'react';

type Code = 'dice' | 'mines' | 'keno' | 'roulette' | 'slots' | 'crash';

interface Props {
  code: Code;
  className?: string;
  style?: CSSProperties;
}

const ASPECT = '16 / 10';

const SHARED_DEFS_ID = 'pn-art';

export function GameArt({ code, className, style }: Props) {
  // Single inline SVG per game. viewBox kept consistent across all
  // games so card containers can size them identically.
  return (
    <div
      className={className}
      style={{ aspectRatio: ASPECT, ...style }}
      aria-hidden
    >
      <svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" className="h-full w-full">
        <SharedDefs />
        {code === 'dice' && <DiceArt />}
        {code === 'mines' && <MinesArt />}
        {code === 'keno' && <KenoArt />}
        {code === 'roulette' && <RouletteArt />}
        {code === 'slots' && <SlotsArt />}
        {code === 'crash' && <CrashArt />}
        <TopHighlight />
      </svg>
    </div>
  );
}

// ---------- Shared SVG defs (reused gradients) ----------

function SharedDefs() {
  return (
    <defs>
      <linearGradient id={`${SHARED_DEFS_ID}-gold`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FFEFA8" />
        <stop offset="50%" stopColor="#FFC845" />
        <stop offset="100%" stopColor="#B8830E" />
      </linearGradient>
      <linearGradient id={`${SHARED_DEFS_ID}-gold-edge`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FFE8A0" />
        <stop offset="100%" stopColor="#8C5F00" />
      </linearGradient>
      <radialGradient id={`${SHARED_DEFS_ID}-glow`} cx="50%" cy="40%" r="60%">
        <stop offset="0%" stopColor="rgba(255,213,84,0.65)" />
        <stop offset="60%" stopColor="rgba(255,213,84,0.12)" />
        <stop offset="100%" stopColor="rgba(255,213,84,0)" />
      </radialGradient>
      <linearGradient id={`${SHARED_DEFS_ID}-emerald`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#9AF7D5" />
        <stop offset="60%" stopColor="#22B27A" />
        <stop offset="100%" stopColor="#0B5C40" />
      </linearGradient>
      <linearGradient id={`${SHARED_DEFS_ID}-ruby`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FFB0AE" />
        <stop offset="55%" stopColor="#D62828" />
        <stop offset="100%" stopColor="#7A0E1E" />
      </linearGradient>
      <linearGradient id={`${SHARED_DEFS_ID}-onyx`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#4D5560" />
        <stop offset="60%" stopColor="#1B1E25" />
        <stop offset="100%" stopColor="#0A0B0F" />
      </linearGradient>
      <linearGradient id={`${SHARED_DEFS_ID}-sapphire`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#A6D7FF" />
        <stop offset="55%" stopColor="#2A6BD8" />
        <stop offset="100%" stopColor="#0B2E72" />
      </linearGradient>
      <filter id={`${SHARED_DEFS_ID}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="2.5" />
        <feOffset dx="0" dy="2" result="off" />
        <feComponentTransfer><feFuncA type="linear" slope="0.55" /></feComponentTransfer>
        <feMerge>
          <feMergeNode />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );
}

function TopHighlight() {
  return (
    <rect x="0" y="0" width="320" height="200" fill={`url(#${SHARED_DEFS_ID}-glow)`} opacity="0.85" />
  );
}

// ---------- Dice ----------
//
// Two gold dice tumbling on a deep casino backdrop. The Pasha "9" on
// the upturned face nods to the brand without using any third-party
// pip artwork.

function DiceArt() {
  return (
    <g>
      <rect x="0" y="0" width="320" height="200" fill="#1A0F2E" />
      <rect x="0" y="0" width="320" height="200" fill="url(#pn-art-glow)" opacity="0.4" />

      {/* die 1 */}
      <g transform="translate(80 110) rotate(-12)" filter="url(#pn-art-shadow)">
        <rect x="-40" y="-40" width="80" height="80" rx="14" fill="url(#pn-art-gold)" stroke="#7A4F00" strokeWidth="2" />
        <rect x="-40" y="-40" width="80" height="20" rx="14" fill="white" opacity="0.18" />
        <circle cx="-16" cy="-16" r="6" fill="#3A1F00" />
        <circle cx="16" cy="-16" r="6" fill="#3A1F00" />
        <circle cx="0" cy="0" r="6" fill="#3A1F00" />
        <circle cx="-16" cy="16" r="6" fill="#3A1F00" />
        <circle cx="16" cy="16" r="6" fill="#3A1F00" />
      </g>

      {/* die 2 */}
      <g transform="translate(200 80) rotate(18)" filter="url(#pn-art-shadow)">
        <rect x="-46" y="-46" width="92" height="92" rx="16" fill="url(#pn-art-gold)" stroke="#7A4F00" strokeWidth="2" />
        <rect x="-46" y="-46" width="92" height="24" rx="16" fill="white" opacity="0.2" />
        <text x="0" y="14" textAnchor="middle" fontFamily="ui-sans-serif, system-ui" fontWeight="900" fontSize="62" fill="#3A1F00">9</text>
      </g>

      {/* sparkles */}
      <g fill="#FFE8A0" opacity="0.9">
        <circle cx="40" cy="40" r="2" />
        <circle cx="280" cy="30" r="2" />
        <circle cx="270" cy="160" r="1.6" />
        <circle cx="20" cy="170" r="1.6" />
      </g>
    </g>
  );
}

// ---------- Mines ----------
//
// 5x5 tile grid with a glowing emerald gem on one safe square and a
// silhouette mine peeking from a corner.

function MinesArt() {
  return (
    <g>
      <rect x="0" y="0" width="320" height="200" fill="#231019" />
      <rect x="0" y="0" width="320" height="200" fill="url(#pn-art-glow)" opacity="0.35" />

      <g transform="translate(60 25)">
        {Array.from({ length: 25 }).map((_, i) => {
          const r = Math.floor(i / 5);
          const c = i % 5;
          const x = c * 32;
          const y = r * 28;
          const safeGem = r === 1 && c === 2;
          const safeRevealed = (r === 2 && c === 1) || (r === 3 && c === 3);
          return (
            <g key={i}>
              <rect x={x} y={y} width="28" height="24" rx="5" fill={safeGem || safeRevealed ? '#0E3522' : '#4A2230'} stroke={safeGem ? '#34D399' : 'rgba(255,255,255,0.08)'} strokeWidth={safeGem ? 1.5 : 1} />
              {safeRevealed ? (
                <polygon
                  points={`${x + 14},${y + 6} ${x + 20},${y + 12} ${x + 14},${y + 18} ${x + 8},${y + 12}`}
                  fill="url(#pn-art-emerald)"
                />
              ) : null}
            </g>
          );
        })}
        {/* hero gem on the highlighted tile */}
        <g transform="translate(78 28)">
          <polygon points="14,-2 26,8 14,26 2,8" fill="url(#pn-art-emerald)" stroke="#34D399" strokeWidth="1" />
          <polygon points="14,-2 14,26 26,8" fill="rgba(255,255,255,0.18)" />
        </g>
      </g>

      {/* bomb silhouette bottom-right */}
      <g transform="translate(250 130)" opacity="0.85">
        <circle cx="0" cy="0" r="28" fill="#0F0F14" stroke="#3A0F0F" strokeWidth="2" />
        <path d="M-2,-26 L4,-30 L2,-34" stroke="#FF7A45" strokeWidth="3" fill="none" />
        <circle cx="2" cy="-34" r="2" fill="#FFC845" />
        <circle cx="-9" cy="-9" r="4" fill="rgba(255,255,255,0.25)" />
      </g>
    </g>
  );
}

// ---------- Keno ----------
//
// Lottery balls falling through a glow. Numbers pulled from the
// player's pick list typography.

function KenoArt() {
  const balls: Array<{ x: number; y: number; r: number; n: string; tone: 'gold' | 'emerald' | 'sapphire' | 'ruby' }> = [
    { x: 64, y: 70, r: 30, n: '07', tone: 'gold' },
    { x: 158, y: 50, r: 36, n: '23', tone: 'ruby' },
    { x: 252, y: 75, r: 30, n: '41', tone: 'sapphire' },
    { x: 110, y: 140, r: 26, n: '58', tone: 'emerald' },
    { x: 210, y: 145, r: 26, n: '80', tone: 'gold' },
  ];
  return (
    <g>
      <rect x="0" y="0" width="320" height="200" fill="#0A2618" />
      <rect x="0" y="0" width="320" height="200" fill="url(#pn-art-glow)" opacity="0.4" />
      {/* arch frame */}
      <path d="M30 180 Q160 -10 290 180" fill="none" stroke="rgba(255,213,84,0.25)" strokeWidth="2" />

      {balls.map((b, i) => (
        <g key={i} filter="url(#pn-art-shadow)">
          <circle cx={b.x} cy={b.y} r={b.r} fill={`url(#pn-art-${b.tone})`} stroke="rgba(0,0,0,0.35)" strokeWidth="1" />
          {/* glossy highlight */}
          <ellipse cx={b.x - b.r * 0.3} cy={b.y - b.r * 0.4} rx={b.r * 0.55} ry={b.r * 0.3} fill="white" opacity="0.25" />
          <text x={b.x} y={b.y + b.r * 0.32} textAnchor="middle" fontFamily="ui-sans-serif, system-ui" fontWeight="900" fontSize={b.r * 0.95} fill="white" style={{ paintOrder: 'stroke' }} stroke="rgba(0,0,0,0.4)" strokeWidth="0.5">{b.n}</text>
        </g>
      ))}
    </g>
  );
}

// ---------- Roulette ----------
//
// A roulette wheel quarter rotated into view with red/black/gold
// segments, plus the gold ball resting on the rim.

function RouletteArt() {
  const segments = 12;
  const cx = 230;
  const cy = 110;
  const r = 110;
  const segs = Array.from({ length: segments }, (_, i) => {
    const a0 = (i / segments) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / segments) * Math.PI * 2 - Math.PI / 2;
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const color = i === 0 ? '#1B1E25' : i % 2 === 1 ? '#D62828' : '#1B1E25';
    return { d: `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1} Z`, color, key: i };
  });

  return (
    <g>
      <rect x="0" y="0" width="320" height="200" fill="#1A0608" />
      <rect x="0" y="0" width="320" height="200" fill="url(#pn-art-glow)" opacity="0.35" />

      {/* wheel */}
      <g filter="url(#pn-art-shadow)">
        <circle cx={cx} cy={cy} r={r + 8} fill="url(#pn-art-gold)" />
        {segs.map((s) => (
          <path key={s.key} d={s.d} fill={s.color} stroke="rgba(255,213,84,0.4)" strokeWidth="0.5" />
        ))}
        <circle cx={cx} cy={cy} r="30" fill="url(#pn-art-gold)" stroke="#7A4F00" strokeWidth="2" />
        <text x={cx} y={cy + 9} textAnchor="middle" fontFamily="ui-sans-serif, system-ui" fontWeight="900" fontSize="26" fill="#3A1F00">9</text>
      </g>

      {/* gold ball on the rim */}
      <circle cx={cx + (r - 10) * Math.cos(-0.45)} cy={cy + (r - 10) * Math.sin(-0.45)} r="8" fill="white" stroke="#7A4F00" strokeWidth="1" />

      {/* side stack of red/black chips */}
      <g transform="translate(50 130)" filter="url(#pn-art-shadow)">
        <ellipse cx="0" cy="0" rx="40" ry="10" fill="#D62828" />
        <ellipse cx="0" cy="-10" rx="40" ry="10" fill="#1B1E25" />
        <ellipse cx="0" cy="-20" rx="40" ry="10" fill="url(#pn-art-gold)" />
      </g>
    </g>
  );
}

// ---------- Slots ----------
//
// Three glossy reels with original symbols. No third-party slot art
// is referenced or imitated; the symbols are stylized letterforms +
// glyphs already used in the game engine.

function SlotsArt() {
  const reelX = [60, 160, 260];
  const symbols = ['7', '★', '◆'];
  const symbolFill = ['#FFC845', '#FFE8A0', '#9AF7D5'];

  return (
    <g>
      <rect x="0" y="0" width="320" height="200" fill="#27160B" />
      <rect x="0" y="0" width="320" height="200" fill="url(#pn-art-glow)" opacity="0.45" />

      {/* cabinet frame */}
      <rect x="20" y="30" width="280" height="140" rx="20" fill="#3B1E0E" stroke="url(#pn-art-gold-edge)" strokeWidth="3" />
      <rect x="20" y="30" width="280" height="30" rx="20" fill="white" opacity="0.06" />

      {reelX.map((x, i) => (
        <g key={i} filter="url(#pn-art-shadow)">
          <rect x={x - 38} y="60" width="76" height="80" rx="12" fill="#0D0608" stroke="#4A2A14" strokeWidth="2" />
          <rect x={x - 38} y="60" width="76" height="20" rx="12" fill="white" opacity="0.07" />
          <text x={x} y="115" textAnchor="middle" fontFamily="ui-serif, Georgia" fontWeight="900" fontSize="52" fill={symbolFill[i]}>{symbols[i]}</text>
        </g>
      ))}

      {/* payline */}
      <line x1="22" y1="100" x2="298" y2="100" stroke="rgba(255,213,84,0.5)" strokeWidth="2" strokeDasharray="4 4" />

      {/* JACKPOT plate */}
      <g transform="translate(160 22)">
        <rect x="-44" y="-12" width="88" height="22" rx="11" fill="url(#pn-art-gold)" stroke="#7A4F00" strokeWidth="1.5" />
        <text x="0" y="4" textAnchor="middle" fontFamily="ui-sans-serif, system-ui" fontWeight="900" fontSize="12" letterSpacing="2" fill="#3A1F00">JACKPOT</text>
      </g>
    </g>
  );
}

// ---------- Crash ----------
//
// A rising neon curve climbing into a multiplier badge, with a
// rocket/flame trail at the tip.

function CrashArt() {
  return (
    <g>
      <rect x="0" y="0" width="320" height="200" fill="#040A1F" />
      <rect x="0" y="0" width="320" height="200" fill="url(#pn-art-glow)" opacity="0.35" />

      {/* grid */}
      <g stroke="rgba(80,140,255,0.18)" strokeWidth="0.8">
        {Array.from({ length: 7 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={30 + i * 26} x2="320" y2={30 + i * 26} />
        ))}
        {Array.from({ length: 8 }).map((_, i) => (
          <line key={`v${i}`} x1={20 + i * 40} y1="0" x2={20 + i * 40} y2="200" />
        ))}
      </g>

      {/* baseline */}
      <line x1="0" y1="170" x2="320" y2="170" stroke="#2A6BD8" strokeWidth="2" />

      {/* glow curve */}
      <path d="M 10 170 Q 110 168 170 130 T 290 30" fill="none" stroke="rgba(255,213,84,0.35)" strokeWidth="14" strokeLinecap="round" />
      {/* main curve */}
      <path d="M 10 170 Q 110 168 170 130 T 290 30" fill="none" stroke="url(#pn-art-gold)" strokeWidth="5" strokeLinecap="round" />

      {/* fill under curve */}
      <path d="M 10 170 Q 110 168 170 130 T 290 30 L 290 170 Z" fill="rgba(255,200,69,0.16)" />

      {/* multiplier badge at the tip */}
      <g transform="translate(264 24)" filter="url(#pn-art-shadow)">
        <rect x="-42" y="-16" width="84" height="32" rx="10" fill="url(#pn-art-gold)" stroke="#7A4F00" strokeWidth="1.5" />
        <text x="0" y="6" textAnchor="middle" fontFamily="ui-sans-serif, system-ui" fontWeight="900" fontSize="18" fill="#3A1F00">9.00x</text>
      </g>

      {/* spark trail */}
      <g fill="#FFE8A0">
        <circle cx="260" cy="42" r="2.2" />
        <circle cx="247" cy="55" r="1.6" />
        <circle cx="233" cy="70" r="1.2" />
      </g>
    </g>
  );
}
