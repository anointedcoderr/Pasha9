// Built by Anointed Coder.
//
// Per-category hero illustration shared by every public category /
// menu page (Hot Games, Live Casino, Slot Games, Crash, Cricket,
// Table Games, Fast, Fishing, Sportsbook, Promotion, Betting Pass,
// Pasha Originals, Lotto, Rewards, VIP, Affiliate, FAQ).
//
// Pure inline SVG, original art. No third-party logos, no copied
// commercial slot symbols. Designed to sit in the right column of
// CategoryHero with the title block on the left.

import { type CSSProperties } from 'react';

export type CategoryCode =
  | 'hotGames'
  | 'pashaOriginals'
  | 'slots'
  | 'liveCasino'
  | 'fishing'
  | 'sportsbook'
  | 'crash'
  | 'cricket'
  | 'tableGames'
  | 'fast'
  | 'promotions'
  | 'rewards'
  | 'vip'
  | 'lotto'
  | 'affiliate'
  | 'bettingPass'
  | 'faq'
  | 'default';

interface Props {
  code: CategoryCode;
  className?: string;
  style?: CSSProperties;
}

const ID = 'pn-cathero';

export function CategoryHeroArt({ code, className, style }: Props) {
  return (
    <div className={className} style={style} aria-hidden>
      <svg viewBox="0 0 320 240" preserveAspectRatio="xMidYMid meet" className="h-full w-full">
        <Defs />
        {render(code)}
        <Sparkles />
      </svg>
    </div>
  );
}

function render(code: CategoryCode) {
  switch (code) {
    case 'hotGames':       return <HotGames />;
    case 'pashaOriginals': return <PashaOriginals />;
    case 'slots':          return <Slots />;
    case 'liveCasino':     return <LiveCasino />;
    case 'fishing':        return <Fishing />;
    case 'sportsbook':     return <Sportsbook />;
    case 'crash':          return <Crash />;
    case 'cricket':        return <Cricket />;
    case 'tableGames':     return <TableGames />;
    case 'fast':           return <Fast />;
    case 'promotions':     return <Promotions />;
    case 'rewards':        return <Rewards />;
    case 'vip':            return <Vip />;
    case 'lotto':          return <Lotto />;
    case 'affiliate':      return <Affiliate />;
    case 'bettingPass':    return <BettingPass />;
    case 'faq':            return <Faq />;
    default:               return <DefaultArt />;
  }
}

// ---------- Shared defs + ornaments ----------

function Defs() {
  return (
    <defs>
      <linearGradient id={`${ID}-gold`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FFEFA8" />
        <stop offset="50%" stopColor="#FFC845" />
        <stop offset="100%" stopColor="#8C5F00" />
      </linearGradient>
      <linearGradient id={`${ID}-gold-edge`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FFE8A0" />
        <stop offset="100%" stopColor="#5A3D00" />
      </linearGradient>
      <linearGradient id={`${ID}-ruby`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FFB0AE" />
        <stop offset="55%" stopColor="#D62828" />
        <stop offset="100%" stopColor="#7A0E1E" />
      </linearGradient>
      <linearGradient id={`${ID}-emerald`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#A6F3CF" />
        <stop offset="55%" stopColor="#22B27A" />
        <stop offset="100%" stopColor="#0B5C40" />
      </linearGradient>
      <linearGradient id={`${ID}-sapphire`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#A6D7FF" />
        <stop offset="55%" stopColor="#2A6BD8" />
        <stop offset="100%" stopColor="#0B2E72" />
      </linearGradient>
      <radialGradient id={`${ID}-spot`} cx="50%" cy="50%" r="60%">
        <stop offset="0%" stopColor="rgba(255,213,84,0.55)" />
        <stop offset="100%" stopColor="rgba(255,213,84,0)" />
      </radialGradient>
      <radialGradient id={`${ID}-spot-cool`} cx="50%" cy="50%" r="60%">
        <stop offset="0%" stopColor="rgba(120,180,255,0.45)" />
        <stop offset="100%" stopColor="rgba(120,180,255,0)" />
      </radialGradient>
      <radialGradient id={`${ID}-spot-rose`} cx="50%" cy="50%" r="60%">
        <stop offset="0%" stopColor="rgba(244,114,182,0.45)" />
        <stop offset="100%" stopColor="rgba(244,114,182,0)" />
      </radialGradient>
      <filter id={`${ID}-shadow`} x="-20%" y="-20%" width="140%" height="160%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
        <feOffset dx="0" dy="3" result="off" />
        <feComponentTransfer><feFuncA type="linear" slope="0.5" /></feComponentTransfer>
        <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
      <filter id={`${ID}-glow`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="5" />
        <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
  );
}

function Sparkles() {
  return (
    <g fill="#FFE8A0" opacity="0.8">
      <circle cx="14" cy="20" r="1.4" />
      <circle cx="62" cy="12" r="1.1" />
      <circle cx="298" cy="32" r="1.6" />
      <circle cx="262" cy="18" r="1.2" />
      <circle cx="22" cy="208" r="1.3" />
      <circle cx="284" cy="220" r="1.3" />
    </g>
  );
}

// ---------- Hot Games ----------
// Flames + lightning bolt + a "TRENDING" gold tag.

function HotGames() {
  return (
    <g>
      <circle cx="180" cy="124" r="120" fill={`url(#${ID}-spot)`} />
      {/* flame stack */}
      <g filter={`url(#${ID}-shadow)`}>
        <path d="M180 40 C 200 80, 240 90, 230 140 C 226 174, 196 200, 168 196 C 132 192, 116 156, 132 124 C 142 104, 158 110, 162 92 C 166 76, 178 64, 180 40 Z"
          fill={`url(#${ID}-ruby)`} />
        <path d="M178 78 C 192 100, 216 108, 208 144 C 204 172, 184 188, 168 184 C 144 178, 138 154, 152 134 C 162 120, 168 122, 170 108 C 172 96, 176 92, 178 78 Z"
          fill={`url(#${ID}-gold)`} opacity="0.9" />
        <path d="M178 116 C 188 130, 198 138, 192 158 C 188 174, 176 180, 168 176 C 156 170, 154 158, 162 148 C 168 142, 172 142, 174 134 C 176 126, 176 124, 178 116 Z"
          fill="#FFE8A0" />
      </g>
      {/* lightning bolt */}
      <g transform="translate(70 90)" filter={`url(#${ID}-shadow)`}>
        <path d="M 0 0 L 26 0 L 12 36 L 32 36 L -2 96 L 10 56 L -10 56 Z" fill={`url(#${ID}-gold)`} stroke="#7A4F00" strokeWidth="1.2" />
      </g>
      {/* trending tag */}
      <g transform="translate(244 188)" filter={`url(#${ID}-shadow)`}>
        <rect x="-44" y="-14" width="88" height="28" rx="14" fill={`url(#${ID}-gold)`} stroke={`url(#${ID}-gold-edge)`} strokeWidth="1.2" />
        <text x="0" y="5" textAnchor="middle" fontFamily="ui-sans-serif, system-ui" fontWeight="900" fontSize="11" letterSpacing="2" fill="#3A1F00">TRENDING</text>
      </g>
    </g>
  );
}

// ---------- Pasha Originals ----------
// Original product mark + dice + gem + ball.

function PashaOriginals() {
  return (
    <g>
      <circle cx="180" cy="120" r="118" fill={`url(#${ID}-spot)`} />
      {/* central P9 emblem */}
      <g transform="translate(180 110)" filter={`url(#${ID}-shadow)`}>
        <circle cx="0" cy="0" r="56" fill={`url(#${ID}-gold)`} stroke={`url(#${ID}-gold-edge)`} strokeWidth="2" />
        <circle cx="0" cy="0" r="50" fill="rgba(0,0,0,0.4)" />
        <text x="0" y="14" textAnchor="middle" fontFamily="ui-sans-serif, system-ui" fontWeight="900" fontSize="46" fill={`url(#${ID}-gold)`}>P9</text>
      </g>
      {/* gold die left */}
      <g transform="translate(90 86) rotate(-14)" filter={`url(#${ID}-shadow)`}>
        <rect x="-26" y="-26" width="52" height="52" rx="10" fill={`url(#${ID}-gold)`} stroke={`url(#${ID}-gold-edge)`} strokeWidth="1.5" />
        <rect x="-26" y="-26" width="52" height="14" rx="10" fill="white" opacity="0.22" />
        <text x="0" y="10" textAnchor="middle" fontFamily="ui-sans-serif, system-ui" fontWeight="900" fontSize="32" fill="#3A1F00">9</text>
      </g>
      {/* gem bottom-left */}
      <g transform="translate(98 178)" filter={`url(#${ID}-shadow)`}>
        <polygon points="0,-16 18,0 0,22 -18,0" fill={`url(#${ID}-emerald)`} stroke="#34D399" />
        <polygon points="0,-16 0,22 18,0" fill="rgba(255,255,255,0.22)" />
      </g>
      {/* ball top-right */}
      <g transform="translate(264 60)" filter={`url(#${ID}-shadow)`}>
        <circle r="22" fill={`url(#${ID}-ruby)`} />
        <ellipse cx="-7" cy="-9" rx="11" ry="6" fill="white" opacity="0.32" />
      </g>
    </g>
  );
}

// ---------- Slot Games ----------

function Slots() {
  const reels = [
    { x: 110, glyph: '7', fill: '#FFC845' },
    { x: 180, glyph: '◆', fill: '#9AF7D5' },
    { x: 250, glyph: '★', fill: '#FFE8A0' },
  ];
  return (
    <g>
      <ellipse cx="180" cy="138" rx="160" ry="84" fill={`url(#${ID}-spot)`} opacity="0.65" />
      <rect x="60" y="40" width="240" height="170" rx="22" fill="#3B1E0E" stroke={`url(#${ID}-gold-edge)`} strokeWidth="3" />
      <rect x="60" y="40" width="240" height="34" rx="22" fill="white" opacity="0.07" />
      <g fill={`url(#${ID}-gold)`}>
        <circle cx="76" cy="124" r="6" />
        <circle cx="76" cy="156" r="6" />
        <circle cx="284" cy="124" r="6" />
        <circle cx="284" cy="156" r="6" />
      </g>
      <g transform="translate(180 28)" filter={`url(#${ID}-shadow)`}>
        <rect x="-58" y="-15" width="116" height="30" rx="15" fill={`url(#${ID}-gold)`} stroke={`url(#${ID}-gold-edge)`} strokeWidth="1.5" />
        <text x="0" y="6" textAnchor="middle" fontFamily="ui-sans-serif, system-ui" fontWeight="900" fontSize="14" letterSpacing="3" fill="#3A1F00">JACKPOT</text>
      </g>
      {reels.map((r, i) => (
        <g key={i} filter={`url(#${ID}-shadow)`}>
          <rect x={r.x - 30} y="84" width="60" height="100" rx="11" fill="#0D0608" stroke="#4A2A14" strokeWidth="2" />
          <rect x={r.x - 30} y="84" width="60" height="22" rx="11" fill="white" opacity="0.08" />
          <text x={r.x} y="150" textAnchor="middle" fontFamily="ui-serif, Georgia" fontWeight="900" fontSize="50" fill={r.fill}>{r.glyph}</text>
        </g>
      ))}
      <line x1="62" y1="134" x2="298" y2="134" stroke="rgba(255,213,84,0.55)" strokeWidth="2" strokeDasharray="4 4" />
    </g>
  );
}

// ---------- Live Casino ----------
// Dealer table feel: roulette chip, card fan, spotlight pool.

function LiveCasino() {
  return (
    <g>
      <ellipse cx="170" cy="160" rx="170" ry="80" fill={`url(#${ID}-spot)`} opacity="0.7" />
      {/* table arc */}
      <path d="M40 200 Q 170 130 300 200 L 300 220 Q 170 154 40 220 Z" fill="rgba(34,178,122,0.85)" stroke="rgba(255,213,84,0.45)" strokeWidth="1.5" />
      {/* card fan */}
      <g transform="translate(122 96) rotate(-12)" filter={`url(#${ID}-shadow)`}>
        <rect x="-22" y="-34" width="44" height="68" rx="6" fill="white" stroke="#3A1F00" strokeWidth="1" />
        <text x="-12" y="-18" fontFamily="ui-sans-serif, system-ui" fontWeight="900" fontSize="13" fill="#D62828">A</text>
        <text x="-12" y="-6" fontFamily="ui-sans-serif, system-ui" fontWeight="900" fontSize="11" fill="#D62828">♥</text>
      </g>
      <g transform="translate(160 92) rotate(2)" filter={`url(#${ID}-shadow)`}>
        <rect x="-22" y="-34" width="44" height="68" rx="6" fill="white" stroke="#3A1F00" strokeWidth="1" />
        <text x="-12" y="-18" fontFamily="ui-sans-serif, system-ui" fontWeight="900" fontSize="13" fill="#1B1E25">K</text>
        <text x="-12" y="-6" fontFamily="ui-sans-serif, system-ui" fontWeight="900" fontSize="11" fill="#1B1E25">♠</text>
      </g>
      <g transform="translate(200 100) rotate(16)" filter={`url(#${ID}-shadow)`}>
        <rect x="-22" y="-34" width="44" height="68" rx="6" fill="white" stroke="#3A1F00" strokeWidth="1" />
        <text x="-12" y="-18" fontFamily="ui-sans-serif, system-ui" fontWeight="900" fontSize="13" fill="#D62828">Q</text>
        <text x="-12" y="-6" fontFamily="ui-sans-serif, system-ui" fontWeight="900" fontSize="11" fill="#D62828">♦</text>
      </g>
      {/* chip */}
      <g transform="translate(264 162)" filter={`url(#${ID}-shadow)`}>
        <circle r="30" fill={`url(#${ID}-gold)`} />
        <circle r="22" fill="rgba(0,0,0,0.5)" />
        <text x="0" y="5" textAnchor="middle" fontFamily="ui-sans-serif, system-ui" fontWeight="900" fontSize="14" fill={`url(#${ID}-gold)`}>500</text>
      </g>
    </g>
  );
}

// ---------- Fishing ----------

function Fishing() {
  return (
    <g>
      <ellipse cx="180" cy="140" rx="170" ry="90" fill={`url(#${ID}-spot-cool)`} opacity="0.85" />
      {/* bubbles */}
      <g fill="rgba(166,215,255,0.7)">
        <circle cx="80" cy="90" r="6" />
        <circle cx="64" cy="70" r="4" />
        <circle cx="248" cy="106" r="5" />
        <circle cx="276" cy="80" r="3" />
        <circle cx="226" cy="76" r="3" />
      </g>
      {/* fish */}
      <g transform="translate(180 130)" filter={`url(#${ID}-shadow)`}>
        <path d="M-66 0 C -58 -34, 24 -36, 50 -8 C 24 28, -58 26, -66 0 Z"
          fill={`url(#${ID}-sapphire)`} stroke="#A6D7FF" strokeWidth="1" />
        <path d="M50 -8 L 86 -22 L 86 14 Z" fill={`url(#${ID}-sapphire)`} stroke="#A6D7FF" strokeWidth="1" />
        <circle cx="22" cy="-6" r="4" fill="white" />
        <circle cx="22" cy="-6" r="2" fill="#0B2E72" />
        <path d="M-30 -6 Q -10 -18, 16 -6" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
      </g>
      {/* hook + coin */}
      <g transform="translate(98 80)" filter={`url(#${ID}-shadow)`}>
        <line x1="0" y1="0" x2="0" y2="48" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" />
        <path d="M0 48 Q 14 60, 0 70 Q -10 60, -2 50" fill="none" stroke="#E5E7EB" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="-22" cy="80" r="12" fill={`url(#${ID}-gold)`} stroke={`url(#${ID}-gold-edge)`} strokeWidth="1" />
        <text x="-22" y="84" textAnchor="middle" fontFamily="ui-sans-serif, system-ui" fontWeight="900" fontSize="10" fill="#3A1F00">৳</text>
      </g>
    </g>
  );
}

// ---------- Sportsbook ----------
// Stadium silhouette + ball + odds board

function Sportsbook() {
  return (
    <g>
      <ellipse cx="180" cy="160" rx="170" ry="80" fill={`url(#${ID}-spot)`} opacity="0.5" />
      {/* stadium curve */}
      <path d="M30 188 Q 170 100 300 188" fill="none" stroke="rgba(255,213,84,0.55)" strokeWidth="2.5" />
      <path d="M40 196 Q 170 116 290 196" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
      {/* floodlights */}
      <g stroke="rgba(255,232,160,0.85)" strokeWidth="2.4">
        <line x1="48" y1="60" x2="48" y2="100" />
        <line x1="284" y1="60" x2="284" y2="100" />
      </g>
      <g fill={`url(#${ID}-gold)`}>
        <circle cx="48" cy="56" r="6" />
        <circle cx="284" cy="56" r="6" />
      </g>
      {/* football */}
      <g transform="translate(126 142)" filter={`url(#${ID}-shadow)`}>
        <circle r="36" fill="white" stroke="#1B1E25" strokeWidth="2" />
        <polygon points="0,-18 16,-8 10,12 -10,12 -16,-8" fill="#1B1E25" />
        <path d="M0 -36 L 0 -18 M 36 -8 L 16 -8 M -36 -8 L -16 -8 M 22 28 L 10 12 M -22 28 L -10 12" stroke="#1B1E25" strokeWidth="2" />
      </g>
      {/* odds slip */}
      <g transform="translate(228 122)" filter={`url(#${ID}-shadow)`}>
        <rect x="-48" y="-32" width="96" height="64" rx="10" fill="#0F1216" stroke="rgba(255,213,84,0.45)" strokeWidth="1.5" />
        <text x="0" y="-12" textAnchor="middle" fontFamily="ui-sans-serif, system-ui" fontWeight="800" fontSize="10" letterSpacing="2" fill={`url(#${ID}-gold)`}>ODDS</text>
        <line x1="-36" y1="-2" x2="36" y2="-2" stroke="rgba(255,255,255,0.15)" />
        <text x="-30" y="14" fontFamily="ui-sans-serif, system-ui" fontWeight="900" fontSize="14" fill="white">2.15</text>
        <text x="6" y="14" fontFamily="ui-sans-serif, system-ui" fontWeight="900" fontSize="14" fill="white">3.40</text>
      </g>
    </g>
  );
}

// ---------- Crash (category) ----------

function Crash() {
  return (
    <g>
      <ellipse cx="160" cy="170" rx="200" ry="110" fill={`url(#${ID}-spot-cool)`} opacity="0.6" />
      <g stroke="rgba(80,140,255,0.18)" strokeWidth="0.8">
        {Array.from({ length: 7 }).map((_, i) => (<line key={`h${i}`} x1="0" y1={36 + i * 30} x2="320" y2={36 + i * 30} />))}
        {Array.from({ length: 8 }).map((_, i) => (<line key={`v${i}`} x1={20 + i * 40} y1="0" x2={20 + i * 40} y2="240" />))}
      </g>
      <line x1="0" y1="206" x2="320" y2="206" stroke="rgba(80,140,255,0.55)" strokeWidth="1.5" />
      <path d="M 12 206 Q 110 204 170 158 T 290 40" fill="none" stroke="rgba(255,213,84,0.35)" strokeWidth="14" strokeLinecap="round" filter={`url(#${ID}-glow)`} />
      <path d="M 12 206 Q 110 204 170 158 T 290 40" fill="none" stroke={`url(#${ID}-gold)`} strokeWidth="5" strokeLinecap="round" />
      <path d="M 12 206 Q 110 204 170 158 T 290 40 L 290 206 Z" fill="rgba(255,200,69,0.16)" />
      <g transform="translate(264 34)" filter={`url(#${ID}-shadow)`}>
        <rect x="-46" y="-18" width="92" height="36" rx="11" fill={`url(#${ID}-gold)`} stroke={`url(#${ID}-gold-edge)`} strokeWidth="1.5" />
        <text x="0" y="6" textAnchor="middle" fontFamily="ui-sans-serif, system-ui" fontWeight="900" fontSize="18" fill="#3A1F00">9.00x</text>
      </g>
    </g>
  );
}

// ---------- Cricket ----------
// Bat + ball + scoreboard + stadium lights

function Cricket() {
  return (
    <g>
      <ellipse cx="180" cy="170" rx="170" ry="80" fill={`url(#${ID}-spot)`} opacity="0.45" />
      {/* stadium arc */}
      <path d="M30 198 Q 170 110 300 198" fill="none" stroke="rgba(255,213,84,0.45)" strokeWidth="2" />
      {/* lights */}
      <g fill={`url(#${ID}-gold)`}>
        <circle cx="52" cy="50" r="6" />
        <circle cx="280" cy="50" r="6" />
        <circle cx="166" cy="32" r="6" />
      </g>
      {/* bat */}
      <g transform="translate(108 130) rotate(-30)" filter={`url(#${ID}-shadow)`}>
        <rect x="-12" y="-50" width="24" height="92" rx="8" fill="#E2C49A" stroke="#7A4F00" strokeWidth="1.2" />
        <rect x="-7" y="-66" width="14" height="22" rx="4" fill="#3A1F00" />
        <rect x="-9" y="-50" width="18" height="6" rx="2" fill="#7A4F00" />
      </g>
      {/* ball */}
      <g transform="translate(214 156)" filter={`url(#${ID}-shadow)`}>
        <circle r="22" fill={`url(#${ID}-ruby)`} stroke="#7A0E1E" strokeWidth="1" />
        <path d="M-18 -10 Q 0 -22, 18 -10 M -18 10 Q 0 22, 18 10" fill="none" stroke="white" strokeWidth="1.4" />
      </g>
      {/* scoreboard */}
      <g transform="translate(254 86)" filter={`url(#${ID}-shadow)`}>
        <rect x="-46" y="-22" width="92" height="44" rx="8" fill="#0F1216" stroke="rgba(255,213,84,0.45)" strokeWidth="1.5" />
        <text x="0" y="-4" textAnchor="middle" fontFamily="ui-sans-serif, system-ui" fontWeight="800" fontSize="10" letterSpacing="2" fill={`url(#${ID}-gold)`}>LIVE</text>
        <text x="0" y="15" textAnchor="middle" fontFamily="ui-sans-serif, system-ui" fontWeight="900" fontSize="16" fill="white">182/4</text>
      </g>
    </g>
  );
}

// ---------- Table Games ----------
// Card fan + dice + chips

function TableGames() {
  return (
    <g>
      <ellipse cx="170" cy="150" rx="170" ry="90" fill={`url(#${ID}-spot)`} opacity="0.55" />
      {/* card fan */}
      <g filter={`url(#${ID}-shadow)`}>
        {[-22, -8, 8, 22].map((rot, i) => (
          <g key={i} transform={`translate(140 130) rotate(${rot})`}>
            <rect x="-22" y="-48" width="44" height="78" rx="6" fill="white" stroke="#3A1F00" strokeWidth="1" />
            <text x="-12" y="-30" fontFamily="ui-sans-serif, system-ui" fontWeight="900" fontSize="12" fill={i % 2 === 0 ? '#D62828' : '#1B1E25'}>{['A','K','Q','J'][i]}</text>
            <text x="-12" y="-16" fontFamily="ui-sans-serif, system-ui" fontWeight="900" fontSize="11" fill={i % 2 === 0 ? '#D62828' : '#1B1E25'}>{['♥','♠','♦','♣'][i]}</text>
          </g>
        ))}
      </g>
      {/* dice */}
      <g transform="translate(254 100) rotate(12)" filter={`url(#${ID}-shadow)`}>
        <rect x="-22" y="-22" width="44" height="44" rx="8" fill={`url(#${ID}-gold)`} stroke={`url(#${ID}-gold-edge)`} strokeWidth="1.4" />
        <g fill="#3A1F00">
          <circle cx="-8" cy="-8" r="2.5" />
          <circle cx="8" cy="-8" r="2.5" />
          <circle cx="-8" cy="8" r="2.5" />
          <circle cx="8" cy="8" r="2.5" />
          <circle cx="0" cy="0" r="2.5" />
        </g>
      </g>
      {/* chip */}
      <g transform="translate(244 178)" filter={`url(#${ID}-shadow)`}>
        <circle r="22" fill="#1B1E25" stroke={`url(#${ID}-gold-edge)`} strokeWidth="2" />
        <circle r="14" fill="#D62828" />
      </g>
    </g>
  );
}

// ---------- Fast ----------
// Speed lines + lightning + clock

function Fast() {
  return (
    <g>
      <ellipse cx="170" cy="130" rx="170" ry="90" fill={`url(#${ID}-spot-rose)`} opacity="0.7" />
      {/* speed lines */}
      <g stroke="rgba(255,232,160,0.75)" strokeWidth="3" strokeLinecap="round">
        <line x1="20" y1="80" x2="120" y2="80" />
        <line x1="34" y1="120" x2="146" y2="120" />
        <line x1="20" y1="160" x2="106" y2="160" />
        <line x1="40" y1="200" x2="124" y2="200" />
      </g>
      {/* big lightning */}
      <g transform="translate(190 124)" filter={`url(#${ID}-shadow)`}>
        <path d="M 0 -64 L 30 -64 L 8 -10 L 40 -10 L -16 80 L 6 18 L -22 18 Z" fill={`url(#${ID}-gold)`} stroke="#7A4F00" strokeWidth="1.5" />
        <path d="M 0 -64 L 30 -64 L 8 -10" fill="white" opacity="0.18" />
      </g>
      {/* clock */}
      <g transform="translate(258 188)" filter={`url(#${ID}-shadow)`}>
        <circle r="22" fill="white" stroke="#3A1F00" strokeWidth="2" />
        <line x1="0" y1="0" x2="0" y2="-14" stroke="#3A1F00" strokeWidth="2.4" strokeLinecap="round" />
        <line x1="0" y1="0" x2="11" y2="3" stroke="#3A1F00" strokeWidth="2" strokeLinecap="round" />
        <circle r="2" fill="#3A1F00" />
      </g>
    </g>
  );
}

// ---------- Promotions ----------
// Gift box + bursting coins + ticket

function Promotions() {
  return (
    <g>
      <circle cx="180" cy="124" r="118" fill={`url(#${ID}-spot)`} />
      {/* gift box */}
      <g transform="translate(180 126)" filter={`url(#${ID}-shadow)`}>
        <rect x="-54" y="-12" width="108" height="64" rx="10" fill={`url(#${ID}-ruby)`} stroke="#7A0E1E" strokeWidth="1.5" />
        <rect x="-54" y="-12" width="108" height="18" rx="10" fill="white" opacity="0.2" />
        <rect x="-10" y="-30" width="20" height="82" fill={`url(#${ID}-gold)`} stroke="#7A4F00" />
        <rect x="-54" y="-12" width="108" height="6" fill={`url(#${ID}-gold)`} />
        {/* bow */}
        <path d="M-30 -34 Q 0 -8, 30 -34 Q 0 -18, -30 -34 Z" fill={`url(#${ID}-gold)`} stroke="#7A4F00" strokeWidth="1" />
      </g>
      {/* coin burst */}
      <g fill={`url(#${ID}-gold)`} stroke={`url(#${ID}-gold-edge)`}>
        <circle cx="90" cy="74" r="14" />
        <circle cx="262" cy="68" r="12" />
        <circle cx="262" cy="184" r="13" />
        <circle cx="74" cy="184" r="11" />
        <circle cx="170" cy="38" r="10" />
      </g>
    </g>
  );
}

// ---------- Rewards ----------
// Trophy + medals + coins

function Rewards() {
  return (
    <g>
      <circle cx="180" cy="128" r="120" fill={`url(#${ID}-spot)`} />
      <g transform="translate(180 126)" filter={`url(#${ID}-shadow)`}>
        {/* trophy body */}
        <path d="M-30 -42 L 30 -42 L 24 6 Q 20 30, 0 32 Q -20 30, -24 6 Z" fill={`url(#${ID}-gold)`} stroke="#7A4F00" strokeWidth="1.5" />
        <ellipse cx="0" cy="-42" rx="30" ry="8" fill={`url(#${ID}-gold-edge)`} />
        {/* handles */}
        <path d="M -30 -28 Q -56 -22, -50 4 Q -44 18, -30 14" fill="none" stroke={`url(#${ID}-gold)`} strokeWidth="4" />
        <path d="M 30 -28 Q 56 -22, 50 4 Q 44 18, 30 14" fill="none" stroke={`url(#${ID}-gold)`} strokeWidth="4" />
        {/* base */}
        <rect x="-22" y="32" width="44" height="8" fill="#7A4F00" />
        <rect x="-32" y="40" width="64" height="10" rx="2" fill="#5A3D00" />
        {/* star */}
        <polygon points="0,-20 6,-6 22,-6 10,4 14,18 0,10 -14,18 -10,4 -22,-6 -6,-6" fill="#FFE8A0" />
      </g>
      {/* medals */}
      <g transform="translate(96 174)" filter={`url(#${ID}-shadow)`}>
        <circle r="22" fill={`url(#${ID}-gold)`} />
        <circle r="13" fill="rgba(0,0,0,0.4)" />
        <text x="0" y="5" textAnchor="middle" fontFamily="ui-sans-serif, system-ui" fontWeight="900" fontSize="12" fill={`url(#${ID}-gold)`}>1</text>
      </g>
      <g transform="translate(254 186)" filter={`url(#${ID}-shadow)`}>
        <circle r="18" fill="#9CA3AF" />
        <circle r="11" fill="rgba(0,0,0,0.4)" />
        <text x="0" y="4" textAnchor="middle" fontFamily="ui-sans-serif, system-ui" fontWeight="900" fontSize="10" fill="#9CA3AF">2</text>
      </g>
    </g>
  );
}

// ---------- VIP ----------
// Crown + sparkles + diamond

function Vip() {
  return (
    <g>
      <circle cx="180" cy="120" r="120" fill={`url(#${ID}-spot)`} />
      <g transform="translate(180 120)" filter={`url(#${ID}-shadow)`}>
        {/* crown */}
        <path d="M -68 14 L -56 -38 L -30 0 L 0 -50 L 30 0 L 56 -38 L 68 14 Z"
          fill={`url(#${ID}-gold)`} stroke="#7A4F00" strokeWidth="1.5" />
        <rect x="-68" y="14" width="136" height="14" rx="4" fill={`url(#${ID}-gold-edge)`} />
        {/* gems on crown */}
        <circle cx="-30" cy="0" r="5" fill={`url(#${ID}-ruby)`} />
        <circle cx="0" cy="-30" r="6" fill={`url(#${ID}-emerald)`} />
        <circle cx="30" cy="0" r="5" fill={`url(#${ID}-sapphire)`} />
      </g>
      {/* big diamond */}
      <g transform="translate(94 168)" filter={`url(#${ID}-shadow)`}>
        <polygon points="0,-22 22,0 0,30 -22,0" fill={`url(#${ID}-sapphire)`} stroke="#A6D7FF" />
        <polygon points="0,-22 0,30 22,0" fill="rgba(255,255,255,0.22)" />
      </g>
      <g transform="translate(258 178)" filter={`url(#${ID}-shadow)`}>
        <polygon points="0,-18 18,0 0,24 -18,0" fill={`url(#${ID}-emerald)`} stroke="#34D399" />
        <polygon points="0,-18 0,24 18,0" fill="rgba(255,255,255,0.22)" />
      </g>
    </g>
  );
}

// ---------- Lotto ----------
// Numbered balls + ticket

function Lotto() {
  return (
    <g>
      <ellipse cx="178" cy="120" rx="160" ry="86" fill={`url(#${ID}-spot)`} opacity="0.55" />
      <g opacity="0.85">
        <rect x="40" y="118" width="240" height="44" rx="22" fill="rgba(0,0,0,0.55)" stroke="rgba(255,213,84,0.25)" />
        <g fill="rgba(255,232,160,0.85)" fontFamily="ui-sans-serif, system-ui" fontWeight="800" fontSize="14">
          <text x="80" y="146" textAnchor="middle">04</text>
          <text x="116" y="146" textAnchor="middle">19</text>
          <text x="152" y="146" textAnchor="middle">28</text>
          <text x="188" y="146" textAnchor="middle">37</text>
          <text x="224" y="146" textAnchor="middle">46</text>
          <text x="260" y="146" textAnchor="middle">55</text>
        </g>
      </g>
      {[
        { x: 96, y: 92, r: 30, n: '09', tone: 'gold' },
        { x: 184, y: 60, r: 38, n: '17', tone: 'ruby' },
        { x: 262, y: 90, r: 30, n: '33', tone: 'sapphire' },
      ].map((b, i) => (
        <g key={i} filter={`url(#${ID}-shadow)`}>
          <circle cx={b.x} cy={b.y} r={b.r} fill={`url(#${ID}-${b.tone as 'gold'|'ruby'|'sapphire'})`} stroke="rgba(0,0,0,0.35)" />
          <ellipse cx={b.x - b.r * 0.3} cy={b.y - b.r * 0.4} rx={b.r * 0.55} ry={b.r * 0.28} fill="white" opacity="0.3" />
          <text x={b.x} y={b.y + b.r * 0.3} textAnchor="middle" fontFamily="ui-sans-serif, system-ui" fontWeight="900" fontSize={b.r * 0.85} fill="white">{b.n}</text>
        </g>
      ))}
    </g>
  );
}

// ---------- Affiliate ----------
// Network nodes

function Affiliate() {
  return (
    <g>
      <ellipse cx="180" cy="120" rx="170" ry="100" fill={`url(#${ID}-spot)`} opacity="0.5" />
      {/* edges */}
      <g stroke="rgba(255,213,84,0.55)" strokeWidth="1.6">
        <line x1="100" y1="80" x2="180" y2="120" />
        <line x1="180" y1="120" x2="260" y2="80" />
        <line x1="180" y1="120" x2="120" y2="190" />
        <line x1="180" y1="120" x2="240" y2="190" />
        <line x1="100" y1="80" x2="120" y2="190" />
        <line x1="260" y1="80" x2="240" y2="190" />
      </g>
      {/* central node */}
      <g transform="translate(180 120)" filter={`url(#${ID}-shadow)`}>
        <circle r="34" fill={`url(#${ID}-gold)`} stroke={`url(#${ID}-gold-edge)`} strokeWidth="1.5" />
        <text x="0" y="6" textAnchor="middle" fontFamily="ui-sans-serif, system-ui" fontWeight="900" fontSize="24" fill="#3A1F00">৳</text>
      </g>
      {/* leaf nodes */}
      {[ {x:100,y:80}, {x:260,y:80}, {x:120,y:190}, {x:240,y:190} ].map((p, i) => (
        <g key={i} transform={`translate(${p.x} ${p.y})`} filter={`url(#${ID}-shadow)`}>
          <circle r="18" fill="#0F1216" stroke={`url(#${ID}-gold-edge)`} strokeWidth="1.5" />
          <circle r="10" fill={`url(#${ID}-gold)`} />
        </g>
      ))}
    </g>
  );
}

// ---------- Betting Pass ----------
// Premium pass card + badge

function BettingPass() {
  return (
    <g>
      <ellipse cx="180" cy="120" rx="170" ry="100" fill={`url(#${ID}-spot)`} opacity="0.55" />
      {/* card */}
      <g transform="translate(180 124) rotate(-8)" filter={`url(#${ID}-shadow)`}>
        <rect x="-100" y="-60" width="200" height="120" rx="14" fill="#1A0D2A" stroke={`url(#${ID}-gold-edge)`} strokeWidth="2" />
        <rect x="-100" y="-60" width="200" height="36" rx="14" fill="white" opacity="0.06" />
        <text x="-86" y="-30" fontFamily="ui-sans-serif, system-ui" fontWeight="900" fontSize="10" letterSpacing="3" fill={`url(#${ID}-gold)`}>BETTING PASS</text>
        <text x="-86" y="22" fontFamily="ui-sans-serif, system-ui" fontWeight="900" fontSize="20" fill="white">PASHA 9</text>
        <text x="-86" y="42" fontFamily="ui-sans-serif, system-ui" fontWeight="700" fontSize="9" letterSpacing="2" fill="rgba(255,255,255,0.6)">PREMIUM MEMBER</text>
        {/* chip on card */}
        <rect x="60" y="-12" width="28" height="22" rx="4" fill={`url(#${ID}-gold)`} stroke="#7A4F00" strokeWidth="0.8" />
        <line x1="60" y1="-2" x2="88" y2="-2" stroke="#7A4F00" strokeWidth="0.8" />
        <line x1="74" y1="-12" x2="74" y2="10" stroke="#7A4F00" strokeWidth="0.8" />
      </g>
      {/* hot ribbon */}
      <g transform="translate(80 70) rotate(-14)" filter={`url(#${ID}-shadow)`}>
        <rect x="-30" y="-12" width="60" height="24" rx="12" fill={`url(#${ID}-ruby)`} stroke="#7A0E1E" />
        <text x="0" y="5" textAnchor="middle" fontFamily="ui-sans-serif, system-ui" fontWeight="900" fontSize="11" letterSpacing="2" fill="white">HOT</text>
      </g>
    </g>
  );
}

// ---------- FAQ ----------

function Faq() {
  return (
    <g>
      <circle cx="180" cy="124" r="120" fill={`url(#${ID}-spot)`} />
      <g transform="translate(180 124)" filter={`url(#${ID}-shadow)`}>
        <circle r="62" fill={`url(#${ID}-gold)`} stroke={`url(#${ID}-gold-edge)`} strokeWidth="2" />
        <circle r="52" fill="rgba(0,0,0,0.45)" />
        <text x="0" y="22" textAnchor="middle" fontFamily="ui-sans-serif, system-ui" fontWeight="900" fontSize="80" fill={`url(#${ID}-gold)`}>?</text>
      </g>
      <g transform="translate(80 80)" filter={`url(#${ID}-shadow)`}>
        <rect x="-26" y="-16" width="52" height="32" rx="8" fill="#1B1E25" stroke="rgba(255,213,84,0.45)" />
        <text x="0" y="6" textAnchor="middle" fontFamily="ui-sans-serif, system-ui" fontWeight="900" fontSize="16" fill={`url(#${ID}-gold)`}>?</text>
      </g>
      <g transform="translate(260 178)" filter={`url(#${ID}-shadow)`}>
        <rect x="-22" y="-14" width="44" height="28" rx="6" fill="#1B1E25" stroke="rgba(255,213,84,0.45)" />
        <text x="0" y="5" textAnchor="middle" fontFamily="ui-sans-serif, system-ui" fontWeight="900" fontSize="14" fill={`url(#${ID}-gold)`}>!</text>
      </g>
    </g>
  );
}

// ---------- Default (fallback) ----------

function DefaultArt() {
  return (
    <g>
      <circle cx="180" cy="124" r="118" fill={`url(#${ID}-spot)`} />
      <g transform="translate(180 124)" filter={`url(#${ID}-shadow)`}>
        <circle r="62" fill={`url(#${ID}-gold)`} stroke={`url(#${ID}-gold-edge)`} strokeWidth="2" />
        <circle r="52" fill="rgba(0,0,0,0.4)" />
        <text x="0" y="22" textAnchor="middle" fontFamily="ui-sans-serif, system-ui" fontWeight="900" fontSize="56" fill={`url(#${ID}-gold)`}>9</text>
      </g>
    </g>
  );
}
