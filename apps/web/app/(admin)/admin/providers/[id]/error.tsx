// Built by Anointed Coder.
//
// Route-level error boundary for /admin/providers/[id]. Catches any
// uncaught render error in the provider detail tree so the page
// shows a useful recovery card instead of the default "client-side
// exception" overlay. The actual fix for any specific crash still
// lives in the child components; this is the safety net.

'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';

export default function ProviderDetailError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surface to the browser console so the operator can copy the
    // stack into a bug report. The Next.js dev/prod runtime also
    // ships a digest we record here.
    console.error('[admin/providers] uncaught render error', error);
  }, [error]);

  return (
    <Card padding="lg">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 text-signal-danger" />
        <div className="min-w-0 grow">
          <p className="text-base font-extrabold text-ink-hi">Provider page failed to render</p>
          <p className="mt-1 text-sm text-ink-mid">
            One of the panels threw while loading. Reload to retry; if it persists, check the browser console for the stack and copy the digest below into a bug report.
          </p>
          {error?.digest ? (
            <p className="mt-2 break-all font-mono text-[11px] text-ink-lo">digest: {error.digest}</p>
          ) : null}
          {error?.message ? (
            <p className="mt-1 break-all font-mono text-[11px] text-ink-lo">message: {error.message}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="gold" leftIcon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => reset()}>Reload this page</Button>
            <Link href="/admin/providers">
              <Button variant="ghost" leftIcon={<ArrowLeft className="h-3.5 w-3.5" />}>Back to providers</Button>
            </Link>
          </div>
        </div>
      </div>
    </Card>
  );
}
