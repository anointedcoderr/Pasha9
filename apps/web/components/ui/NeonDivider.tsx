import { cn } from '@/lib/utils/cn';

export function NeonDivider({ className }: { className?: string }) {
  return <div className={cn('divider-neon w-full', className)} aria-hidden />;
}

export function VerticalDivider({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('h-full w-px bg-gradient-to-b from-transparent via-neon/40 to-transparent', className)}
    />
  );
}
