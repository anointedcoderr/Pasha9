// Built by Anointed Coder.
//
// A player's personal referral QR code. Scanning it opens the site with the
// registration dialog already open and this player's referral code already
// filled in, so the connection between referrer and new player survives even
// when the person scanning types nothing.
//
// Rendered in the browser, not on the server. The 2FA route generates its QR
// server-side and carries a warning that toDataURL is CPU-bound; that is fine
// for a page visited once per account, but the referral page is one of the
// most visited signed-in pages on the site. The library is loaded on demand
// inside the effect, so it is fetched only when this card actually renders.
//
// The download button exists because the main way these get shared in
// practice is as a saved image forwarded on WhatsApp, not as a live scan of
// someone's screen.

'use client';

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';

interface Props {
  /** The player's invite link, e.g. https://pasha9.com/?r=CODE */
  inviteLink: string;
  /** Used in the downloaded filename so a saved image says whose it is. */
  referralCode: string;
}

/**
 * The QR encodes the invite link plus signup=1, which the header already
 * treats as "open the registration dialog for guests". Built with the URL
 * API rather than string concatenation so an inviteLink that ever gains its
 * own query string still composes correctly.
 */
function qrTarget(inviteLink: string): string {
  try {
    const url = new URL(inviteLink);
    url.searchParams.set('signup', '1');
    return url.toString();
  } catch {
    return inviteLink;
  }
}

/**
 * Saving the image the way each platform actually allows.
 *
 * A plain <a download> on a data URL does nothing on iOS Safari, which is
 * where the client pressed the button and nothing happened. So, in order:
 * the native share sheet where files can be shared (iOS's own Save Image
 * path, and modern Android), a Blob download where the attribute is honoured
 * (desktop and Android browsers), and opening the image in a new tab as the
 * last resort, where a long-press saves it.
 */
async function saveQr(dataUrl: string, referralCode: string, bn: boolean): Promise<void> {
  const filename = `referral-qr-${referralCode || 'code'}.png`;

  // data URL -> Blob without fetch, so this works under any CSP.
  const base64 = dataUrl.split(',')[1] ?? '';
  const bytes = atob(base64);
  const buf = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i += 1) buf[i] = bytes.charCodeAt(i);
  const blob = new Blob([buf], { type: 'image/png' });

  const file = new File([blob], filename, { type: 'image/png' });
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: bn ? 'আমার রেফারেল QR কোড' : 'My referral QR code',
      });
      return;
    } catch {
      // Cancelled or unsupported mid-flight; fall through to the download.
    }
  }

  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Delayed so the click has consumed the URL before it is revoked.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

export function ReferralQrCode({ inviteLink, referralCode }: Props) {
  const { lang } = useLang();
  const bn = lang === 'bn';
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!inviteLink) return;
    let alive = true;
    // Dynamic import keeps the QR library out of every other page's bundle.
    import('qrcode')
      .then((QRCode) =>
        QRCode.toDataURL(qrTarget(inviteLink), {
          width: 480,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: { dark: '#0F1115', light: '#FFFFFF' },
        }),
      )
      .then((url) => { if (alive) setDataUrl(url); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [inviteLink]);

  // No link yet (data still loading upstream) renders nothing; the card
  // appears when there is something real to encode.
  if (!inviteLink) return null;

  if (failed) {
    return (
      <p role="status" className="text-sm text-brand-inkMute">
        {bn ? 'QR কোড তৈরি করা যায়নি। লিংকটি কপি করে শেয়ার করুন।' : 'The QR code could not be generated. Share your link instead.'}
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-5">
      <div className="flex h-40 w-40 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-brand-divider bg-white p-2">
        {dataUrl ? (
          // A plain img, deliberately: the data URL is generated locally and
          // next/image adds nothing to an inline base64 source.
          <img
            src={dataUrl}
            alt={bn ? 'আপনার রেফারেল QR কোড' : 'Your referral QR code'}
            className="h-full w-full"
          />
        ) : (
          <span aria-hidden className="h-full w-full animate-pulse rounded-lg bg-brand-surface" />
        )}
      </div>
      <div className="min-w-0 text-center sm:text-left">
        <p className="text-sm font-semibold text-ink-hi">
          {bn ? 'স্ক্যান করলেই রেজিস্টার পেজ খুলবে' : 'Scanning opens the register page'}
        </p>
        <p className="mt-1 text-xs text-brand-inkMute">
          {bn
            ? 'আপনার রেফারেল কোড নিজে থেকেই বসে যাবে, কিছু টাইপ করতে হবে না।'
            : 'Your referral code is filled in automatically, nothing to type.'}
        </p>
        {dataUrl ? (
          <button
            type="button"
            onClick={() => void saveQr(dataUrl, referralCode, bn)}
            className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg border border-brand-divider bg-brand-surface px-4 text-sm font-medium text-ink-hi hover:border-brand-yellow-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500/40"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {bn ? 'QR সেভ করুন' : 'Save QR'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
