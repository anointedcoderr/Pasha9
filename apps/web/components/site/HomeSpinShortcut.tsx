// Built by Anointed Coder.
//
// Floating "Spin" shortcut shown over the home page. Operator asked
// for a Babu88-style spinning-wheel widget that floats above the
// content so the Spin reward feature is discoverable without
// requiring the player to drill into the Rewards page from a menu.
//
// Positioned fixed to the viewport, right edge, above the existing
// FloatingContact chat bubble (which sits at bottom-[120px+safe-area]
// on mobile / bottom-6 on desktop with z-50). We render at z-50 so
// the tap lands on this shortcut even when another fixed surface
// happens to share the same coordinates - the previous z-40 lost to
// any sibling at the same level rendered later in the DOM.
//
// Hidden on routes under /rewards because the player is already on
// the spin page; otherwise visible on every layout that mounts this
// component (currently just the public homepage at (site)/page.tsx).
//
// Click is handled by an explicit onClick + router.push so a webview
// that swallows the touchstart-to-click path on an anchor tag (some
// older Android WebView + iOS Safari builds report this) still
// navigates correctly. The Next.js Link wrapper was failing
// intermittently for the operator's test device, so we drop it.

'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useLang } from '@/lib/i18n/context';

const TARGET_HREF = '/rewards?tab=spin';

export function HomeSpinShortcut() {
  const { lang } = useLang();
  const bn = lang === 'bn';
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Skip on the rewards page itself so the player is not nudged at
  // something they are already looking at.
  if (pathname?.startsWith('/rewards')) return null;
  if (!mounted) return null;

  const handleActivate = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(TARGET_HREF);
  };

  return (
    <button
      type="button"
      onClick={handleActivate}
      // Belt + braces: some Android webview builds fire onTouchEnd but
      // not the synthesised click. Catch the touch directly so the
      // navigation runs either way.
      onTouchEnd={handleActivate}
      aria-label={bn ? 'স্পিন হুইল' : 'Spin Wheel'}
      style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'rgba(245,180,0,0.25)' }}
      className="group fixed bottom-[calc(180px+env(safe-area-inset-bottom))] right-2 z-50 flex flex-col items-center rounded-full border-0 bg-transparent p-1 outline-none focus-visible:ring-2 focus-visible:ring-amber-300 active:scale-95 lg:bottom-[calc(88px+env(safe-area-inset-bottom))] lg:right-5"
    >
      <span className="pointer-events-none relative inline-flex h-12 w-12 items-center justify-center drop-shadow-[0_4px_14px_rgba(245,180,0,0.4)]">
        {/* Continuously rotating wheel. pointer-events-none so taps
            land on the parent button instead of the rotating SVG -
            some mobile webviews otherwise swallow the tap when the
            transform is mid-frame. */}
        <svg
          viewBox="0 0 100 100"
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ animation: 'pasha-spin 7s linear infinite' }}
        >
          <defs>
            <radialGradient id="spinRim" cx="50%" cy="50%" r="50%">
              <stop offset="80%" stopColor="#fbd66a" />
              <stop offset="100%" stopColor="#8b5a00" />
            </radialGradient>
          </defs>
          {/* outer rim */}
          <circle cx="50" cy="50" r="48" fill="url(#spinRim)" stroke="#5a3a1d" strokeWidth="1.5" />
          {/* 8 alternating segments */}
          {Array.from({ length: 8 }).map((_, i) => {
            const angle = (i * 45 - 22.5) * (Math.PI / 180);
            const x = 50 + 42 * Math.cos(angle);
            const y = 50 + 42 * Math.sin(angle);
            const a2 = (i * 45 + 22.5) * (Math.PI / 180);
            const x2 = 50 + 42 * Math.cos(a2);
            const y2 = 50 + 42 * Math.sin(a2);
            return (
              <path
                key={i}
                d={`M 50 50 L ${x} ${y} A 42 42 0 0 1 ${x2} ${y2} Z`}
                fill={i % 2 === 0 ? '#fbd66a' : '#c4304d'}
                stroke="#5a3a1d"
                strokeWidth="0.5"
              />
            );
          })}
          {/* lights around the rim */}
          {Array.from({ length: 12 }).map((_, i) => {
            const angle = (i * 30) * (Math.PI / 180);
            const x = 50 + 45 * Math.cos(angle);
            const y = 50 + 45 * Math.sin(angle);
            return <circle key={`l-${i}`} cx={x} cy={y} r="1.5" fill="#fff7d6" />;
          })}
          {/* hub */}
          <circle cx="50" cy="50" r="9" fill="#fbd66a" stroke="#5a3a1d" strokeWidth="1" />
          <circle cx="50" cy="50" r="4" fill="#5a3a1d" />
        </svg>
        {/* Stationary pointer at top, on a higher layer so it does
            not spin with the wheel below. */}
        <svg
          viewBox="0 0 100 100"
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          <path d="M 50 6 L 56 18 L 44 18 Z" fill="#c4304d" stroke="#5a3a1d" strokeWidth="1" />
        </svg>
      </span>

      {/* Local keyframes. The `style jsx` block scopes them to the
          component without polluting the global stylesheet. */}
      <style jsx>{`
        @keyframes pasha-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </button>
  );
}
