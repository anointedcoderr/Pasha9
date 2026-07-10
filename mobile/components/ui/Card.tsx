// Built by Anointed Coder.
//
// Card: a rounded white surface with a hairline border and soft shadow.
// The default building block for light content islands. Set `tone="dark"`
// for a premium dark island (used inside dark sections).
//
// Props:
//   tone       'light' | 'dark'  surface style (default 'light')
//   padded     boolean           apply inner padding (default true)
//   className  string            extra classes
//   onPress    () => void        makes the whole card pressable

import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { cn } from '@/lib/cn';

export interface CardProps {
  children: ReactNode;
  tone?: 'light' | 'dark';
  padded?: boolean;
  className?: string;
  onPress?: () => void;
}

export function Card({ children, tone = 'light', padded = true, className, onPress }: CardProps) {
  const base = cn(
    'rounded-2xl border',
    tone === 'dark'
      ? 'border-white/10 bg-darkbg'
      : 'border-divider bg-paper shadow-sm shadow-black/5',
    padded && 'p-4',
    className,
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} className={cn(base, 'active:opacity-90')}>
        {children}
      </Pressable>
    );
  }
  return <View className={base}>{children}</View>;
}
