import { type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export function PageHeader({
  title,
  subtitle,
  action,
  icon,
  back,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  /**
   * Optional back link, shown above the title. A real href to a known parent
   * page rather than router.back(): several of these pages are opened from a
   * drawer with no dedicated URL of their own (Wallet Audit and Turnover open
   * from a row in Users, not from a page that exists at their own address),
   * so browser history does not reliably lead somewhere useful, and a page
   * reached from a bookmark or shared link has no in-app history to go back
   * through at all. A fixed destination always works.
   */
  back?: { href: string; label: string };
  className?: string;
}) {
  return (
    <div className={cn('mb-6 flex flex-col gap-3', className)}>
      {back ? (
        <Link
          href={back.href}
          className="inline-flex w-fit items-center gap-1.5 rounded-lg px-1 py-1 text-sm font-medium text-ink-mid hover:text-ink-hi focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500/40"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
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
    </div>
  );
}
