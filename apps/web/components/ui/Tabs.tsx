'use client';

import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils/cn';

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }: TabsPrimitive.TabsListProps) {
  return (
    <TabsPrimitive.List
      className={cn(
        'inline-flex h-11 items-center gap-1 rounded-xl border border-neon/10 bg-base-panel/60 p-1 text-sm',
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: TabsPrimitive.TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'inline-flex h-9 items-center justify-center rounded-lg px-4 font-medium text-ink-mid transition',
        'data-[state=active]:bg-gradient-to-r data-[state=active]:from-gold-300 data-[state=active]:to-gold-700 data-[state=active]:text-base-deep data-[state=active]:shadow-glow-gold',
        'hover:text-ink-hi',
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: TabsPrimitive.TabsContentProps) {
  return <TabsPrimitive.Content className={cn('mt-5', className)} {...props} />;
}
