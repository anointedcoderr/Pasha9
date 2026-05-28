// Built by Anointed Coder.
//
// Per-game hero illustration. Richer than GameArt: foreground
// objects are larger, layered with rim light + ambient spotlight,
// sparkles and decorative streaks. Designed for the right-hand
// column of the game-page hero ribbon. Pure inline SVG: no third-
// party assets, no raster downloads. Original work.

import { type CSSProperties } from 'react';

type Code = 'dice' | 'mines' | 'keno' | 'roulette' | 'slots' | 'crash';

interface Props {
  code: Code;
  className?: string;
  style?: CSSProperties;
}

const ID = 'pn-hero';

export function HeroArt({ code, className, style }: Props) {
  return (
    <div className={className} style={style} aria-hidden>
      <svg viewBox="0 0 320 240" preserveAspectRatio="xMidYMid meet" className="h-full w-full">
        <SharedDefs />
        {code === 'dice' && <DiceHero />}
        {code === 'mines' && <MinesHero />}
        {code === 'keno' && <KenoHero />}
        {code === 'roulette' && <RouletteHero />}
        {code === 'slots' && <SlotsHero />}
        {code === 'crash' && <CrashHero />}
        <Sparkles />
      </svg>
    </div>
  );
}

function SharedDefs() {
  return (
    <defs>
      <linearGradient id={`${ID}-gold`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FFEFA8" />
        <stop offset="45%" stopColor="#FFC845" />
        <stop offset="100%" stopColor="#8C5F00" />
      </linearGradient>
      <linearGradient id={`${ID}-gold-edge`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FFE8A0" />
        <stop offset="100%" stopColor="#5A3D00" />
      </linearGradient>
      <radialGradient id={`${ID}-spot`} cx="50%" cy="50%" r="60%">
        <stop offset="0%" stopColor="rgba(255,213,84,0.55)" />
        <stop offset="60%" stopColor="rgba(255,213,84,0.10)" />
        <stop offset="100%" stopColor="rgba(255,213,84,0)" />
      </radialGradient>
      <radialGradient id={`${ID}-spot-cool`} cx="50%" cy="50%" r="60%">
        <stop offset="0%" stopColor="rgba(120,180,255,0.45)" />
        <stop offset="100%" stopColor="rgba(120,180,255,0)" />
      </radialGradient>
      <linearGradient id={`${ID}-emerald`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#A6F3CF" />
        <stop offset="55%" stopColor="#22B27A" />
        <stop offset="100%" stopColor="#0B5C40" />
      </linearGradient>
      <linearGradient id={`${ID}-ruby`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FFB6B4" />
        <stop offset="55%" stopColor="#E0273A" />
        <stop offset="100%" stopColor="#7A0E1E" />
      </linearGradient>
      <linearGradient id={`${ID}-sapphire`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#A6D7FF" />
        <stop offset="55%" stopColor="#2A6BD8" />
        <stop offset="100%" stopColor="#0B2E72" />
      </linearGradient>
      <linearGradient id={`${ID}-onyx`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#4D5560" />
        <stop offset="55%" stopColor="#1B1E25" />
        <stop offset="100%" stopColor="#04060B" />
      </linearGradient>
      <filter id={`${ID}-shadow`} x="-20%" y="-20%" width="140%" height="160%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
        <feOffset dx="0" dy="3" result="off" />
        <feComponentTransfer><feFuncA type="linear" slope="0.55" /></feComponentTransfer>
        <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <filter id={`${ID}-glow`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="6" />
        <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
  );
}

function Sparkles() {
  // Subtle ambient particles. Same set across games so they read as
  // part of the brand's "ambient casino" voice. Positioned away from
  // typical text overlap zones.
  return (
    <g fill="#FFE8A0" opacity="0.85">
      <circle cx="14" cy="22" r="1.6" />
      <circle cx="60" cy="14" r="1.2" />
      <circle cx="298" cy="34" r="1.8" />
      <circle cx="262" cy="18" r="1.2" />
      <circle cx="22" cy="200" r="1.4" />
      <circle cx="280" cy="218" r="1.4" />
    </g>
  );
}

// ---------- Dice ----------
// Three gold dice in a stack: rear shows pips, mid-front shows the
// pasha-9 face, foremost shows pips. Glow halo behind the stack.

function DiceHero() {
  return (
    <g>
      <circle cx="200" cy="120" r="120" fill={`url(#${ID}-spot)`} />
      {/* rear die */}
      <g transform="translate(110 110) rotate(-18)" filter={`url(#${ID}-shadow)`}>
        <rect x="-36" y="-36" width="72" height="72" rx="13" fill={`url(#${ID}-gold)`} stroke={`url(#${ID}-gold-edge)`} strokeWidth="2" />
        <rect x="-36" y="-36" width="72" height="20" rx="13" fill="white" opacity="0.22" />
        <g fill="#3A1F00">
          <circle cx="-16" cy="-16" r="5" />
          <circle cx="16" cy="-16" r="5" />
          <circle cx="-16" cy="16" r="5" />
          <circle cx="16" cy="16" r="5" />
        </g>
      </g>
      {/* hero die with 9 */}
      <g transform="translate(190 96) rotate(8)" filter={`url(#${ID}-shadow)`}>
        <rect x="-48" y="-48" width="96" height="96" rx="18" fill={`url(#${ID}-gold)`} stroke={`url(#${ID}-gold-edge)`} strokeWidth="2.5" />
        <rect x="-48" y="-48" width="96" height="28" rx="18" fill="white" opacity="0.22" />
        <text x="0" y="14" textAnchor="middle" fontFamily="ui-sans-serif, system-ui" fontWeight="900" fontSize="62" fill="#3A1F00">9</text>
      </g>
      {/* foremost die */}
      <g transform="translate(240 156) rotate(-12)" filter={`url(#${ID}-shadow)`}>
        <rect x="-30" y="-30" width="60" height="60" rx="11" fill={`url(#${ID}-gold)`} stroke={`url(#${ID}-gold-edge)`} strokeWidth="2" />
        <rect x="-30" y="-30" width="60" height="16" rx="11" fill="white" opacity="0.22" />
        <g fill="#3A1F00">
          <circle cx="-12" cy="-12" r="4" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="0" cy="0" r="4" />
        </g>
      </g>
      {/* motion streaks */}
      <g stroke="rgba(255,232,160,0.65)" strokeWidth="2" strokeLinecap="round" fill="none">
        <path d="M40 80 L78 90" />
        <path d="M30 110 L62 116" />
        <path d="M44 140 L80 142" />
      </g>
    </g>
  );
}

// ---------- Mines ----------
// 5x5 grid in perspective with a glowing gem on the highlighted tile
// and a bomb peeking from the bottom-right corner. Treasure vs hazard.

function MinesHero() {
  return (
    <g>
      <ellipse cx="160" cy="160" rx="160" ry="60" fill={`url(#${ID}-spot)`} opacity="0.7" />
      <g transform="translate(98 30)">
        {Array.from({ length: 25 }).map((_, i) => {
          const r = Math.floor(i / 5);
          const c = i % 5;
          const x = c * 32;
          const y = r * 32;
          const safeGem = r === 1 && c === 2;
          const safeRevealed = (r === 0 && c === 1) || (r === 2 && c === 3) || (r === 3 && c === 1);
          return (
            <g key={i}>
              <rect x={x} y={y} width="28" height="28" rx="6" fill={safeGem || safeRevealed ? '#0E3522' : '#3A1828'} stroke={safeGem ? '#34D399' : 'rgba(255,255,255,0.08)'} strokeWidth={safeGem ? 1.6 : 1} />
              <rect x={x} y={y} width="28" height="8" rx="6" fill="white" opacity={safeGem || safeRevealed ? 0.16 : 0.08} />
              {safeRevealed ? (
                <polygon
                  points={`${x + 14},${y + 6} ${x + 22},${y + 14} ${x + 14},${y + 22} ${x + 6},${y + 14}`}
                  fill={`url(#${ID}-emerald)`}
                  stroke="#34D399"
                  strokeWidth="0.8"
                />
              ) : null}
            </g>
          );
        })}
        {/* hero gem on the highlighted tile */}
        <g transform="translate(86 24)" filter={`url(#${ID}-shadow)`}>
          <polygon points="14,-4 28,10 14,30 0,10" fill={`url(#${ID}-emerald)`} stroke="#34D399" strokeWidth="1.2" />
          <polygon points="14,-4 14,30 28,10" fill="rgba(255,255,255,0.22)" />
        </g>
      </g>
      {/* bomb bottom-right */}
      <g transform="translate(258 168)" filter={`url(#${ID}-shadow)`}>
        <circle cx="0" cy="0" r="30" fill="#0E0F14" stroke="#3A0F0F" strokeWidth="2" />
        <path d="M-4,-28 L4,-32 L6,-38" stroke="#FF7A45" strokeWidth="3" fill="none" />
        <circle cx="6" cy="-38" r="2.5" fill="#FFC845" />
        <circle cx="-10" cy="-10" r="5" fill="rgba(255,255,255,0.25)" />
      </g>
    </g>
  );
}

// ---------- Keno ----------
// Five glossy lottery balls in a cascade, plus a soft ticket band
// behind them suggesting a draw board.

function KenoHero() {
  const balls: Array<{ x: number; y: number; r: number; n: string; tone: 'gold' | 'emerald' | 'sapphire' | 'ruby' }> = [
    { x: 88, y: 90, r: 34, n: '07', tone: 'gold' },
    { x: 178, y: 60, r: 40, n: '23', tone: 'ruby' },
    { x: 264, y: 88, r: 34, n: '41', tone: 'sapphire' },
    { x: 124, y: 168, r: 30, n: '58', tone: 'emerald' },
    { x: 230, y: 178, r: 30, n: '80', tone: 'gold' },
  ];
  return (
    <g>
      <ellipse cx="178" cy="120" rx="160" ry="86" fill={`url(#${ID}-spot)`} opacity="0.55" />
      {/* draw board band */}
      <g opacity="0.85">
        <rect x="40" y="118" width="240" height="44" rx="22" fill="rgba(0,0,0,0.55)" stroke="rgba(255,213,84,0.25)" />
        <g fill="rgba(255,232,160,0.85)" fontFamily="ui-sans-serif, system-ui" fontWeight="800" fontSize="14">
          <text x="80" y="146" textAnchor="middle">03</text>
          <text x="116" y="146" textAnchor="middle">15</text>
          <text x="152" y="146" textAnchor="middle">27</text>
          <text x="188" y="146" textAnchor="middle">42</text>
          <text x="224" y="146" textAnchor="middle">59</text>
          <text x="260" y="146" textAnchor="middle">71</text>
        </g>
      </g>
      {balls.map((b, i) => (
        <g key={i} filter={`url(#${ID}-shadow)`}>
          <circle cx={b.x} cy={b.y} r={b.r} fill={`url(#${ID}-${b.tone})`} stroke="rgba(0,0,0,0.35)" strokeWidth="1" />
          <ellipse cx={b.x - b.r * 0.3} cy={b.y - b.r * 0.4} rx={b.r * 0.55} ry={b.r * 0.28} fill="white" opacity="0.3" />
          <text x={b.x} y={b.y + b.r * 0.34} textAnchor="middle" fontFamily="ui-sans-serif, system-ui" fontWeight="900" fontSize={b.r * 0.95} fill="white" paintOrder="stroke" stroke="rgba(0,0,0,0.45)" strokeWidth="0.5">{b.n}</text>
        </g>
      ))}
    </g>
  );
}

// ---------- Roulette ----------
// Wheel quarter-turn with red/black segments, a gold rim, a small
// stack of chips and a white ball resting on the rim.

function RouletteHero() {
  const cx = 210;
  const cy = 124;
  const r = 96;
  const segs = Array.from({ length: 16 }, (_, i) => {
    const a0 = (i / 16) * Math.PI * 2 - Math.PI / 2;
    const a1 = ((i + 1) / 16) * Math.PI * 2 - Math.PI / 2;
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const color = i === 0 ? '#1B1E25' : i % 2 === 1 ? '#D62828' : '#1B1E25';
    return { d: `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 0 1 ${x1} ${y1} Z`, color, key: i };
  });
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx="160" ry="100" fill={`url(#${ID}-spot)`} opacity="0.7" />
      {/* wheel */}
      <g filter={`url(#${ID}-shadow)`}>
        <circle cx={cx} cy={cy} r={r + 9} fill={`url(#${ID}-gold)`} />
        <circle cx={cx} cy={cy} r={r + 4} fill="rgba(0,0,0,0.35)" />
        {segs.map((s) => (
          <path key={s.key} d={s.d} fill={s.color} stroke="rgba(255,213,84,0.35)" strokeWidth="0.5" />
        ))}
        <circle cx={cx} cy={cy} r="34" fill={`url(#${ID}-gold)`} stroke="#7A4F00" strokeWidth="2" />
        <text x={cx} y={cy + 10} textAnchor="middle" fontFamily="ui-sans-serif, system-ui" fontWeight="900" fontSize="28" fill="#3A1F00">9</text>
      </g>
      {/* ball on rim */}
      <circle cx={cx + (r - 4) * Math.cos(-0.55)} cy={cy + (r - 4) * Math.sin(-0.55)} r="9" fill="white" stroke="#7A4F00" strokeWidth="1" />
      {/* chip stack */}
      <g transform="translate(70 168)" filter={`url(#${ID}-shadow)`}>
        <ellipse cx="0" cy="0" rx="46" ry="11" fill="#D62828" stroke="rgba(255,255,255,0.25)" />
        <ellipse cx="0" cy="-10" rx="46" ry="11" fill="#1B1E25" stroke="rgba(255,255,255,0.25)" />
        <ellipse cx="0" cy="-20" rx="46" ry="11" fill={`url(#${ID}-gold)`} stroke="#7A4F00" />
        <text x="0" y="-16" textAnchor="middle" fontFamily="ui-sans-serif, system-ui" fontWeight="900" fontSize="12" fill="#3A1F00">100</text>
      </g>
    </g>
  );
}

// ---------- Slots ----------
// 3-reel cabinet with original symbols 7 / diamond / star, a JACKPOT
// nameplate above and side lamps for casino vibe.

function SlotsHero() {
  const reels = [
    { x: 110, glyph: '7', fill: '#FFC845' },
    { x: 180, glyph: '◆', fill: '#9AF7D5' },
    { x: 250, glyph: '★', fill: '#FFE8A0' },
  ];
  return (
    <g>
      <ellipse cx="180" cy="138" rx="160" ry="84" fill={`url(#${ID}-spot)`} opacity="0.7" />
      {/* cabinet */}
      <rect x="60" y="40" width="240" height="170" rx="22" fill="#3B1E0E" stroke={`url(#${ID}-gold-edge)`} strokeWidth="3" />
      <rect x="60" y="40" width="240" height="34" rx="22" fill="white" opacity="0.07" />
      {/* side lamps */}
      <g fill={`url(#${ID}-gold)`}>
        <circle cx="76" cy="124" r="6" />
        <circle cx="76" cy="156" r="6" />
        <circle cx="284" cy="124" r="6" />
        <circle cx="284" cy="156" r="6" />
      </g>
      {/* JACKPOT plate */}
      <g transform="translate(180 28)" filter={`url(#${ID}-shadow)`}>
        <rect x="-58" y="-15" width="116" height="30" rx="15" fill={`url(#${ID}-gold)`} stroke={`url(#${ID}-gold-edge)`} strokeWidth="1.5" />
        <text x="0" y="6" textAnchor="middle" fontFamily="ui-sans-serif, system-ui" fontWeight="900" fontSize="14" letterSpacing="3" fill="#3A1F00">JACKPOT</text>
      </g>
      {/* reels */}
      {reels.map((r, i) => (
        <g key={i} filter={`url(#${ID}-shadow)`}>
          <rect x={r.x - 30} y="84" width="60" height="100" rx="11" fill="#0D0608" stroke="#4A2A14" strokeWidth="2" />
          <rect x={r.x - 30} y="84" width="60" height="22" rx="11" fill="white" opacity="0.08" />
          <text x={r.x} y="150" textAnchor="middle" fontFamily="ui-serif, Georgia" fontWeight="900" fontSize="50" fill={r.fill}>{r.glyph}</text>
        </g>
      ))}
      {/* payline */}
      <line x1="62" y1="134" x2="298" y2="134" stroke="rgba(255,213,84,0.55)" strokeWidth="2" strokeDasharray="4 4" />
    </g>
  );
}

// ---------- Crash ----------
// Neon multiplier curve climbing to a "9.00x" badge with rocket
// trail sparks. Gridded chart backdrop for the casino feel.

function CrashHero() {
  return (
    <g>
      <ellipse cx="160" cy="170" rx="200" ry="110" fill={`url(#${ID}-spot-cool)`} opacity="0.6" />
      {/* grid */}
      <g stroke="rgba(80,140,255,0.18)" strokeWidth="0.8">
        {Array.from({ length: 7 }).map((_, i) => (<line key={`h${i}`} x1="0" y1={36 + i * 30} x2="320" y2={36 + i * 30} />))}
        {Array.from({ length: 8 }).map((_, i) => (<line key={`v${i}`} x1={20 + i * 40} y1="0" x2={20 + i * 40} y2="240" />))}
      </g>
      {/* baseline */}
      <line x1="0" y1="206" x2="320" y2="206" stroke="rgba(80,140,255,0.55)" strokeWidth="1.5" />
      {/* glow curve underlay */}
      <path d="M 12 206 Q 110 204 170 158 T 290 40" fill="none" stroke="rgba(255,213,84,0.35)" strokeWidth="14" strokeLinecap="round" filter={`url(#${ID}-glow)`} />
      {/* main curve */}
      <path d="M 12 206 Q 110 204 170 158 T 290 40" fill="none" stroke={`url(#${ID}-gold)`} strokeWidth="5" strokeLinecap="round" />
      {/* fill under curve */}
      <path d="M 12 206 Q 110 204 170 158 T 290 40 L 290 206 Z" fill="rgba(255,200,69,0.16)" />
      {/* multiplier badge at the tip */}
      <g transform="translate(264 34)" filter={`url(#${ID}-shadow)`}>
        <rect x="-46" y="-18" width="92" height="36" rx="11" fill={`url(#${ID}-gold)`} stroke={`url(#${ID}-gold-edge)`} strokeWidth="1.5" />
        <text x="0" y="6" textAnchor="middle" fontFamily="ui-sans-serif, system-ui" fontWeight="900" fontSize="18" fill="#3A1F00">9.00x</text>
      </g>
      {/* spark trail */}
      <g fill="#FFE8A0">
        <circle cx="260" cy="52" r="2.4" />
        <circle cx="244" cy="66" r="1.8" />
        <circle cx="226" cy="82" r="1.4" />
        <circle cx="210" cy="98" r="1" />
      </g>
    </g>
  );
}
