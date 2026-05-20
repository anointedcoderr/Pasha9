import { type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-12 text-center', className)}>
      <div className="mb-1 flex h-14 w-14 items-center justify-center rounded-full border border-neon/15 bg-base-panel text-neon">
        {icon ?? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6">
            <circle cx="12" cy="12" r="9" />
            <path d="M9 12l2 2 4-4" />
          </svg>
        )}
      </div>
      <h4 className="text-base font-semibold text-ink-hi">{title}</h4>
      {description ? <p className="max-w-md text-sm text-ink-lo">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
