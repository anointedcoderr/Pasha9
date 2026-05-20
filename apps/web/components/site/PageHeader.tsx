import { type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export function PageHeader({ title, subtitle, action, icon, className }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between', className)}>
      <div className="flex items-start gap-3">
        {icon ? (
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-neon/15 bg-base-panel/60 text-neon">
            {icon}
          </span>
        ) : null}
        <div>
          <h1 className="text-2xl font-bold text-ink-hi md:text-3xl">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-ink-mid">{subtitle}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
