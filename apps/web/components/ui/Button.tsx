import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

type Variant = 'gold' | 'neon' | 'ghost' | 'danger' | 'solid' | 'glass';
type Size = 'sm' | 'md' | 'lg' | 'icon';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  full?: boolean;
}

const variants: Record<Variant, string> = {
  gold: 'btn-gold hover:brightness-105 active:brightness-95',
  neon: 'btn-neon',
  ghost: 'bg-transparent text-ink-mid hover:text-ink-hi hover:bg-white/5 border border-transparent',
  danger: 'bg-signal-danger/10 border border-signal-danger/40 text-signal-danger hover:bg-signal-danger/15',
  solid: 'bg-base-elev border border-neon/15 text-ink-hi hover:border-neon/40',
  glass: 'bg-white/[0.04] border border-white/10 text-ink-hi hover:bg-white/[0.08] backdrop-blur',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm rounded-lg',
  md: 'h-11 px-5 text-sm rounded-xl',
  lg: 'h-12 px-7 text-base rounded-xl',
  icon: 'h-10 w-10 p-0 rounded-xl',
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant = 'gold', size = 'md', loading, leftIcon, rightIcon, full, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        'relative inline-flex items-center justify-center gap-2 font-semibold transition will-change-transform',
        'disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        full && 'w-full',
        'overflow-hidden',
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {variant === 'gold' && (
        <span aria-hidden className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-sheen" />
      )}
      {loading ? (
        <span className="inline-block h-4 w-4 rounded-full border-2 border-current border-r-transparent animate-spin" />
      ) : (
        leftIcon
      )}
      <span className="relative">{children}</span>
      {!loading && rightIcon}
    </button>
  );
});
