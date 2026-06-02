// Built by Anointed Coder.
//
// Global admin error boundary. Catches any uncaught render error
// in /admin/* (except the more specific /admin/providers/[id]
// boundary, which still wins because it is closer). Stops a single
// bad component from collapsing the entire admin shell into a
// blank "Application error" overlay.
//
// The root fix for any specific crash lives in the child
// component; this boundary is the safety net + the place we capture
// the digest for triage.

'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { AlertCircle, Home, RefreshCw } from 'lucide-react';

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[admin] uncaught render error', error);
  }, [error]);

  return (
    <div className="p-4">
      <Card padding="lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 text-signal-danger" />
          <div className="min-w-0 grow">
            <p className="text-base font-extrabold text-ink-hi">Admin page failed to render</p>
            <p className="mt-1 text-sm text-ink-mid">
              A component on this page raised an error during render. Reload to retry. If it persists, copy the digest below into a bug report so the developer can locate the offending component fast.
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
