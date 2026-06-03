// Built by Anointed Coder.
//
// Public deposit page. M4 Phase C:
//   - Payment methods come from /api/content/payment-methods (DB-backed,
//     now includes Upay).
//   - Pre-deposit notice popup driven by /api/content/deposit-notice and
//     the deposit_notice_enabled SystemSetting. Once acknowledged the
//     popup stays closed for the rest of the tab session.
//   - Live bonus preview via /api/content/deposit-preview as the player
//     edits the amount. Shows percentage / bonus amount / total credit.
//   - Real screenshot upload through /api/deposits/proof (multipart),
//     attaching the returned proofUrl to the deposit submission.
//   - Mobile-friendly notice modal that scrolls inside.

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormField, Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { depositSchema, type DepositInput } from '@/lib/utils/validation';
import { useT, useLang } from '@/lib/i18n/context';
import { triggerWalletRefresh } from '@/components/site/WalletStrip';
import { AlertTriangle, CheckCircle2, Lock, LogIn, Upload, X, ExternalLink } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { DepositWithdrawTabs } from '@/components/wallet/DepositWithdrawTabs';
import { PaymentMethodPicker } from '@/components/wallet/PaymentMethodPicker';
import { SelectedMethodCard } from '@/components/wallet/SelectedMethodCard';

const QUICK = [500, 1000, 2000, 5000, 10000, 25000];

interface PublicMethod {
  id: string;
  name: string;
  type: string;
  number: string | null;
  instruction: string | null;
  instructionBn: string | null;
  iconUrl: string | null;
  bannerUrl: string | null;
  minDeposit: number | null;
  maxDeposit: number | null;
}

interface NoticeRow {
  id: string;
  titleEn: string;
  titleBn: string | null;
  bodyEn: string;
  bodyBn: string | null;
  ctaLabelEn: string;
  ctaLabelBn: string | null;
}

interface PreviewState {
  bonusPercentage: number;
  bonusAmount: number;
  totalCredit: number;
}

type AuthState =
  | { kind: 'checking' }
  | { kind: 'guest' }
  | { kind: 'authed'; username: string };

const NOTICE_ACK_KEY = 'pasha9_deposit_notice_ack';

export default function DepositPage() {
  const t = useT();
  const { lang } = useLang();
  const router = useRouter();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [proofUrl, setProofUrl] = useState<string | null>(null);
  const [proofName, setProofName] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverDetail, setServerDetail] = useState<string | null>(null);
  const [submittedDepositId, setSubmittedDepositId] = useState<string | null>(null);
  const [auth, setAuth] = useState<AuthState>({ kind: 'checking' });
  const [methods, setMethods] = useState<PublicMethod[]>([]);
  const [methodsLoaded, setMethodsLoaded] = useState(false);
  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewState>({ bonusPercentage: 0, bonusAmount: 0, totalCredit: 0 });
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Auth probe (unchanged from M1 behaviour). Reruns on wallet-refresh
  // so a fresh login in the same tab clears the banner.
  useEffect(() => {
    let alive = true;
    const probe = () => {
      fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!alive) return;
          if (data?.user?.username) {
            setAuth({ kind: 'authed', username: String(data.user.username) });
          } else {
            setAuth({ kind: 'guest' });
          }
        })
        .catch(() => { if (alive) setAuth({ kind: 'guest' }); });
    };
    probe();
    const handler = () => probe();
    window.addEventListener('pasha9:wallet-refresh', handler);
    return () => { alive = false; window.removeEventListener('pasha9:wallet-refresh', handler); };
  }, []);

  // Payment methods + notice fetched in parallel on mount.
  useEffect(() => {
    let alive = true;
    fetch('/api/content/payment-methods', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive) return;
        const list: PublicMethod[] = Array.isArray(j?.deposit) ? j.deposit : [];
        setMethods(list);
        setMethodsLoaded(true);
      })
      .catch(() => { if (alive) setMethodsLoaded(true); });

    fetch('/api/content/deposit-notice', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive) return;
        if (j?.enabled && Array.isArray(j?.notices) && j.notices.length > 0) {
          let acked = false;
          try { acked = sessionStorage.getItem(NOTICE_ACK_KEY) === '1'; } catch { acked = false; }
          if (!acked) {
            setNotices(j.notices as NoticeRow[]);
            setNoticeOpen(true);
          }
        }
      })
      .catch(() => { /* notice optional */ });

    return () => { alive = false; };
  }, []);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitted },
  } = useForm<DepositInput>({
    resolver: zodResolver(depositSchema),
    defaultValues: { amount: 0, method: '', txn: '' },
  });

  // Default method = first DB method once it loads.
  useEffect(() => {
    if (methodsLoaded && methods.length > 0 && !watch('method')) {
      setValue('method', methods[0].name);
    }
  }, [methodsLoaded, methods, setValue, watch]);

  const watchedAmount = watch('amount');
  const watchedMethodName = watch('method');
  const method = methods.find((m) => m.name === watchedMethodName);

  // Live bonus preview with 250 ms debounce.
  useEffect(() => {
    const n = Number(watchedAmount) || 0;
    if (previewTimer.current) clearTimeout(previewTimer.current);
    if (n <= 0) {
      setPreview({ bonusPercentage: 0, bonusAmount: 0, totalCredit: 0 });
      return;
    }
    previewTimer.current = setTimeout(() => {
      fetch(`/api/content/deposit-preview?amount=${encodeURIComponent(String(n))}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (!j) return;
          setPreview({
            bonusPercentage: Number(j.bonusPercentage) || 0,
            bonusAmount: Number(j.bonusAmount) || 0,
            totalCredit: Number(j.totalCredit) || n,
          });
        })
        .catch(() => { /* preview is best-effort */ });
    }, 250);
    return () => { if (previewTimer.current) clearTimeout(previewTimer.current); };
  }, [watchedAmount]);

  const errorEntries = Object.entries(errors).map(([field, e]) => ({
    field,
    message: e?.message ? String(e.message) : 'Invalid value',
  }));

  const acknowledgeNotice = () => {
    try { sessionStorage.setItem(NOTICE_ACK_KEY, '1'); } catch { /* ok */ }
    setNoticeOpen(false);
  };

  const onProofChange = useCallback(async (file: File | null) => {
    setUploadError(null);
    if (!file) {
      setProofUrl(null);
      setProofName(null);
      return;
    }
    setUploading(true);
    setProofName(file.name);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch('/api/deposits/proof', { method: 'POST', body: fd, credentials: 'include' });
      const j = await r.json().catch(() => null);
      if (!r.ok) {
        const code = j?.code as string | undefined;
        const msg = j?.message as string | undefined;
        if (code === 'BAD_MIME') setUploadError(msg ?? 'Unsupported file type. Use PNG, JPG, WEBP or PDF.');
        else if (code === 'TOO_LARGE') setUploadError(msg ?? 'File too large. Max 8 MB.');
        else if (code === 'RATE_LIMITED') setUploadError('Too many uploads. Please wait and try again.');
        else if (r.status === 401) setUploadError('Please log in to upload proof.');
        else setUploadError(msg ?? code ?? 'Upload failed.');
        setProofUrl(null);
        return;
      }
      setProofUrl(String(j.proofUrl));
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed.');
      setProofUrl(null);
    } finally {
      setUploading(false);
    }
  }, []);

  const onSubmit = async (values: DepositInput) => {
    setServerError(null);
    setServerDetail(null);

    if (auth.kind !== 'authed') {
      setServerError('Please log in before submitting a deposit.');
      router.push('/?login=1');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/deposits', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          amount: Number(values.amount),
          method: values.method,
          transactionId: values.txn,
          proofUrl: proofUrl ?? undefined,
        }),
      });
      const data = await res.json().catch(() => ({} as Record<string, unknown>));

      if (!res.ok) {
        const code = typeof data?.code === 'string' ? (data.code as string) : null;
        const message = typeof data?.message === 'string' ? (data.message as string) : null;
        if (res.status === 401) {
          setServerError('Your session has expired. Please log in again.');
          setAuth({ kind: 'guest' });
          router.push('/?login=1');
          return;
        }
        if (res.status === 429) {
          setServerError('Too many submissions. Please wait a minute and try again.');
          return;
        }
        if (code === 'VALIDATION') {
          setServerError('The form values were rejected by the server. Please double-check the amount, method and transaction ID.');
          setServerDetail(`HTTP 400 . VALIDATION`);
          return;
        }
        setServerError(message ?? code ?? 'Could not submit deposit.');
        setServerDetail(`HTTP ${res.status}${code ? ` . ${code}` : ''}`);
        return;
      }

      const newId = typeof data?.deposit === 'object' && data.deposit !== null
        ? (data.deposit as { id?: string }).id ?? null
        : null;

      if (!newId) {
        setServerError('Deposit was accepted but no reference id was returned. Please refresh and check /dashboard/transactions.');
        return;
      }

      setSubmittedDepositId(newId);
      setSubmitted(true);
      triggerWalletRefresh();
    } catch (err) {
      setServerError('Network error. Please check your connection and try again.');
      setServerDetail(err instanceof Error ? err.message : null);
    } finally {
      setLoading(false);
    }
  };

  const newRequest = () => {
    setSubmitted(false);
    setSubmittedDepositId(null);
    setProofUrl(null);
    setProofName(null);
    setUploadError(null);
    setServerError(null);
    setServerDetail(null);
    reset({ amount: 0, method: methods[0]?.name ?? '', txn: '' });
  };

  const canSubmit = auth.kind === 'authed' && !loading && !uploading;

  const noticeBlocks = useMemo(() => notices, [notices]);

  return (
    <>
      <DepositWithdrawTabs active="deposit" />

      {auth.kind === 'guest' ? (
        <Card padding="md" className="mb-4 border border-amber-300/60 bg-amber-50">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-5 w-5 text-amber-700" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">You must be logged in to submit a deposit.</p>
              <p className="text-xs text-amber-800">Sessions are required so the request can be attached to your account.</p>
            </div>
            <Link href="/?login=1" className="btn-yellow inline-flex h-9 items-center rounded-lg px-3 text-sm">
              <LogIn className="mr-1.5 h-4 w-4" /> Log in
            </Link>
          </div>
        </Card>
      ) : null}

      {submitted ? (
        <Card tone="elev" className="mx-auto max-w-2xl text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-neon/15 text-neon">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-semibold text-ink-hi">Deposit request submitted</h2>
          <p className="mt-2 text-sm text-ink-mid">Your request is pending admin review. Main balance and lottery tickets are credited after approval.</p>
          {submittedDepositId ? (
            <p className="mt-1 text-xs text-ink-lo">Reference: <code className="font-mono">{submittedDepositId}</code></p>
          ) : null}
          <div className="mt-6 flex justify-center gap-3">
            <Button variant="neon" onClick={newRequest}>New Request</Button>
          </div>
        </Card>
      ) : (
        <div className="mx-auto w-full max-w-2xl pb-24">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
            <Card padding="lg">
              <CardHeader title="Amount" subtitle="Choose a preset or enter a custom value" />
              <div className="mb-4 flex flex-wrap gap-2">
                {QUICK.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setValue('amount', q, { shouldValidate: true })}
                    className="rounded-pill border border-neon/15 bg-base-deep/40 px-4 py-1.5 text-sm text-ink-mid transition hover:border-neon/40 hover:text-ink-hi"
                  >
                    BDT {q.toLocaleString()}
                  </button>
                ))}
              </div>
              <FormField label={t('deposit.amount')} required error={errors.amount?.message}>
                <Input type="number" min={0} step={100} {...register('amount')} placeholder="500" invalid={!!errors.amount} />
              </FormField>

              {preview.bonusAmount > 0 ? (
                <div className="mt-3 rounded-xl border border-emerald-500/60 bg-gradient-to-br from-emerald-500/25 to-emerald-700/35 p-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-50">
                    {lang === 'bn' ? 'বোনাস প্রিভিউ' : 'Bonus preview'}
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/85">{lang === 'bn' ? 'বোনাস %' : 'Bonus %'}</p>
                      <p className="text-base font-extrabold text-white">{preview.bonusPercentage}%</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/85">{lang === 'bn' ? 'বোনাস' : 'Bonus'}</p>
                      <p className="text-base font-extrabold text-white">+ BDT {preview.bonusAmount.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/85">{lang === 'bn' ? 'মোট ক্রেডিট' : 'Total credit'}</p>
                      <p className="text-base font-extrabold text-white">BDT {preview.totalCredit.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ) : (Number(watchedAmount) || 0) > 0 ? (
                <p className="mt-2 text-[11px] font-semibold text-ink-mid">
                  {lang === 'bn' ? 'এই পরিমাণের জন্য সক্রিয় বোনাস টিয়ার নেই।' : 'No active bonus tier matches this amount.'}
                </p>
              ) : null}
            </Card>

            <Card padding="lg">
              <CardHeader title={t('deposit.method')} subtitle={lang === 'bn' ? 'যে মাধ্যমে পেমেন্ট পাঠিয়েছেন সেটি বেছে নিন' : 'Pick how you sent the payment'} />
              {!methodsLoaded ? (
                <p className="text-sm text-ink-mid">{lang === 'bn' ? 'মাধ্যম লোড হচ্ছে...' : 'Loading methods...'}</p>
              ) : methods.length === 0 ? (
                <p className="text-sm text-ink-mid">{lang === 'bn' ? 'কোনো ডিপোজিট মাধ্যম কনফিগার করা নেই।' : 'No deposit methods configured.'}</p>
              ) : (
                <>
                  <PaymentMethodPicker
                    methods={methods.map((m) => ({ id: m.id, name: m.name, type: m.type, iconUrl: m.iconUrl }))}
                    selectedName={watchedMethodName ?? ''}
                    onSelect={(name) => setValue('method', name, { shouldValidate: true })}
                  />
                  {method ? (
                    <SelectedMethodCard
                      mode="deposit"
                      className="mt-4"
                      method={{
                        id: method.id,
                        name: method.name,
                        type: method.type,
                        number: method.number,
                        iconUrl: method.iconUrl,
                        bannerUrl: method.bannerUrl,
                        instruction: method.instruction,
                        instructionBn: method.instructionBn,
                      }}
                    />
                  ) : null}
                  {method?.minDeposit ? (
                    <p className="mt-2 text-[11px] text-ink-lo">
                      {lang === 'bn' ? 'এই মাধ্যমের সীমা: ' : 'This method: '} Min BDT {method.minDeposit.toLocaleString()}
                      {method.maxDeposit ? ` . Max BDT ${method.maxDeposit.toLocaleString()}` : ''}
                    </p>
                  ) : null}
                </>
              )}
            </Card>

            <Card padding="lg">
              <CardHeader title="Verification" subtitle="Paste the TX ID and upload screenshot" />
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label={t('deposit.txn')} required error={errors.txn?.message}>
                  <Input placeholder="TRX-3845921" {...register('txn')} invalid={!!errors.txn} />
                </FormField>
                <FormField label={t('deposit.proof')}>
                  <label className="flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-neon/25 bg-base-deep/40 px-3 text-sm text-ink-mid hover:border-neon/45 hover:text-ink-hi">
                    <Upload className="h-4 w-4" />
                    <span className="truncate">
                      {uploading
                        ? 'Uploading...'
                        : proofUrl
                          ? proofName ?? 'Uploaded'
                          : 'Click to upload PNG, JPG, WEBP or PDF'}
                    </span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,application/pdf"
                      className="hidden"
                      onChange={(e) => onProofChange(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </FormField>
              </div>
              {uploadError ? (
                <p className="mt-2 text-xs text-red-600">{uploadError}</p>
              ) : proofUrl ? (
                <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Proof uploaded.
                  <a href={proofUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
                    View <ExternalLink className="h-3 w-3" />
                  </a>
                  <button
                    type="button"
                    onClick={() => { setProofUrl(null); setProofName(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    className="ml-auto inline-flex items-center gap-1 text-red-600"
                  >
                    <X className="h-3 w-3" /> Remove
                  </button>
                </p>
              ) : (
                <p className="mt-2 text-[11px] text-ink-lo">PNG, JPG, WEBP or PDF, max 8 MB.</p>
              )}
            </Card>

            {isSubmitted && errorEntries.length > 0 ? (
              <div className="rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <p className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4" /> Please fix the highlighted fields:
                </p>
                <ul className="mt-1 list-disc pl-6">
                  {errorEntries.map((e) => (
                    <li key={e.field}><span className="capitalize">{e.field}</span> - {e.message}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {serverError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <p className="font-semibold">{serverError}</p>
                {serverDetail ? <p className="mt-0.5 text-xs text-red-700/80">{serverDetail}</p> : null}
              </div>
            ) : null}

            <Button type="submit" size="lg" loading={loading} disabled={!canSubmit} className="w-full md:w-auto">
              {t('deposit.submit')}
            </Button>
          </form>
        </div>
      )}

      {noticeOpen && noticeBlocks.length > 0 ? (
        <NoticePopup notices={noticeBlocks} lang={lang} onAcknowledge={acknowledgeNotice} />
      ) : null}
    </>
  );
}

function NoticePopup({ notices, lang, onAcknowledge }: { notices: NoticeRow[]; lang: 'en' | 'bn'; onAcknowledge: () => void }) {
  const cta = notices[0];
  const ctaLabel = lang === 'bn' && cta?.ctaLabelBn ? cta.ctaLabelBn : cta?.ctaLabelEn ?? 'I understand';

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-3 sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <div className="flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-amber-400/40 bg-[#1a1a1a] text-white shadow-2xl">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">{lang === 'bn' ? 'গুরুত্বপূর্ণ নোটিশ' : 'Important notice'}</p>
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4 text-sm">
          {notices.map((n) => {
            const title = lang === 'bn' && n.titleBn ? n.titleBn : n.titleEn;
            const body = lang === 'bn' && n.bodyBn ? n.bodyBn : n.bodyEn;
            return (
              <div key={n.id}>
                <h3 className="text-base font-bold">{title}</h3>
                <p className="mt-2 whitespace-pre-wrap leading-relaxed text-white/85">{body}</p>
              </div>
            );
          })}
        </div>
        <div className="shrink-0 border-t border-white/10 px-4 py-3">
          <Button
            variant="gold"
            className="w-full"
            onClick={onAcknowledge}
          >
            {ctaLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
