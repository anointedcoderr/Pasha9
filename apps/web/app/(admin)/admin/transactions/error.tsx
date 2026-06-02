// Built by Anointed Coder.
//
// Route-scoped error boundary for /admin/transactions. Stops any
// uncaught render error in the platform Transaction log from
// crashing into the bare Application Error overlay.

'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { AlertCircle, Home, RefreshCw } from 'lucide-react';

export default function TransactionsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[admin/transactions] uncaught render error', error);
  }, [error]);

  return (
    <div className="p-4">
      <Card padding="lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 text-signal-danger" />
          <div className="min-w-0 grow">
            <p className="text-base font-extrabold text-ink-hi">Transaction log failed to render</p>
            <p className="mt-1 text-sm text-ink-mid">
              The platform transaction log threw during render. Reload to retry. If it persists, copy the digest below into a bug report.
            </p>
            {error?.digest ? (
              <p className="mt-2 break-all font-mono text-[11px] text-ink-lo">digest: {error.digest}</p>
            ) : null}
            {error?.message ? (
              <p className="mt-1 break-all font-mono text-[11px] text-ink-lo">message: {error.message}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="gold" leftIcon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => reset()}>Reload this page</Button>
              <Link href="/admin">
                <Button variant="ghost" leftIcon={<Home className="h-3.5 w-3.5" />}>Admin home</Button>
              </Link>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
