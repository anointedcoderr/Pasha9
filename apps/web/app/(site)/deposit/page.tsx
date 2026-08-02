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

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
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
import { cn } from '@/lib/utils/cn';
import { SelectedMethodCard } from '@/components/wallet/SelectedMethodCard';
import { useAnnounce } from '@/components/ui/LiveRegion';

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
  badgeLabelEn: string | null;
  badgeLabelBn: string | null;
  badgeEnabled: boolean;
}

// One StarPay-backed player-facing tile. StarPay itself is never shown to
// the player - the operator configures bKash/Nagad/Rocket as three
// independent tiles (enable, label, icon, order) in /admin/payments, each
// routing to its own StarPay channel behind the scenes.
interface StarpayTile {
  key: 'bkash' | 'nagad' | 'rocket';
  label: string;
  icon: string | null;
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
  promotionName?: string | null;
}

interface PromotionIntent {
  promotionId: string;
  promoCode: string | null;
  recommendedAmount: number;
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
  const announce = useAnnounce();
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
  // ChaopaoPay availability + selected payment-method state. The
  // probe runs once at mount; gateway tiles only render when the
  // operator has the credentials configured in /admin/payments.
  // expressBusy keeps the tile disabled while we open the gateway
  // round-trip so the player cannot double-click and create two
  // pending deposits.
  //
  // gatewayChoice is null when the player has not picked anything OR
  // has picked a manual method (the manual selection lives on the
  // react-hook-form `method` field). When it is set to 'bkash' or
  // 'nagad', the manual TX-ID / proof card is hidden and the bottom
  // CTA becomes "Pay BDT X with bKash/Nagad" which opens the
  // ChaopaoPay-hosted payment page.
  const [expressAvailable, setExpressAvailable] = useState(false);
  // expressChecked / zinipayChecked flip true once each availability
  // probe settles (success or failure). The method grid waits for
  // methodsLoaded AND both flags before deciding between the empty
  // state and the tile grid, so a gateway-only operator never sees
  // the "no deposit methods" card flash while the probes are still
  // in flight.
  const [expressChecked, setExpressChecked] = useState(false);
  const [expressMethods, setExpressMethods] = useState<string[]>([]);
  const [expressIcons, setExpressIcons] = useState<{ bkash: string | null; nagad: string | null }>({ bkash: null, nagad: null });
  const [expressBusy, setExpressBusy] = useState<null | 'bkash' | 'nagad'>(null);
  const [expressError, setExpressError] = useState<string | null>(null);
  const [gatewayChoice, setGatewayChoice] = useState<null | 'bkash' | 'nagad' | 'zinipay' | 'starpay_bkash' | 'starpay_nagad' | 'starpay_rocket'>(null);
  // ZinIPay hosted-gateway probe. A tile only renders when the operator
  // has enabled + keyed ZinIPay in /admin/payments. The player picks the
  // wallet (bKash / Nagad / Rocket) on the ZinIPay page itself, so there
  // is no per-method choice on our side.
  const [zinipayAvailable, setZinipayAvailable] = useState(false);
  const [zinipayChecked, setZinipayChecked] = useState(false);
  const [zinipayIcon, setZinipayIcon] = useState<string | null>(null);
  const [zinipayBusy, setZinipayBusy] = useState(false);
  // StarPay-backed tiles. Unlike ZinIPay (one combined tile, wallet picked
  // on the hosted page), StarPay renders as up to three separate branded
  // tiles - bKash / Nagad / Rocket - each independently enabled by the
  // operator and each routed to its own StarPay channel on our side. The
  // player never sees "StarPay" anywhere.
  const [starpayMethods, setStarpayMethods] = useState<StarpayTile[]>([]);
  const [starpayChecked, setStarpayChecked] = useState(false);
  const [starpayBusy, setStarpayBusy] = useState<null | 'bkash' | 'nagad' | 'rocket'>(null);
  const [notices, setNotices] = useState<NoticeRow[]>([]);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewState>({ bonusPercentage: 0, bonusAmount: 0, totalCredit: 0 });
  const [promotionIntent, setPromotionIntent] = useState<PromotionIntent | null>(null);
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

    // Probe whether the ChaopaoPay deposit gateway is enabled and
    // which methods (bkash, nagad) the operator has turned on. The
    // Quick Pay card only renders when at least one method comes
    // back available.
    fetch('/api/payments/chaopaopay/availability', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive) return;
        if (j?.available && Array.isArray(j.methods) && j.methods.length > 0) {
          setExpressAvailable(true);
          setExpressMethods(j.methods.filter((m: unknown): m is string => typeof m === 'string'));
          const icons = j.icons ?? {};
          setExpressIcons({
            bkash: typeof icons.bkash === 'string' && icons.bkash.trim() ? icons.bkash : null,
            nagad: typeof icons.nagad === 'string' && icons.nagad.trim() ? icons.nagad : null,
          });
        }
      })
      .catch(() => { /* probe is best-effort; Quick Pay just stays hidden */ })
      .finally(() => { if (alive) setExpressChecked(true); });

    // ZinIPay availability probe (independent of ChaopaoPay).
    fetch('/api/payments/zinipay/availability', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive) return;
        if (j?.available) {
          setZinipayAvailable(true);
          setZinipayIcon(typeof j.icon === 'string' && j.icon.trim() ? j.icon : null);
        }
      })
      .catch(() => { /* probe is best-effort */ })
      .finally(() => { if (alive) setZinipayChecked(true); });

    // StarPay availability probe (independent of the other gateways).
    // Returns only the tiles that are actually enabled right now, already
    // sorted by the operator's display order.
    fetch('/api/payments/starpay/availability', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive) return;
        if (Array.isArray(j?.methods)) {
          const valid = (j.methods as unknown[]).reduce<StarpayTile[]>((acc, raw) => {
            if (!raw || typeof raw !== 'object') return acc;
            const r = raw as Record<string, unknown>;
            if (r.key !== 'bkash' && r.key !== 'nagad' && r.key !== 'rocket') return acc;
            acc.push({
              key: r.key,
              label: typeof r.label === 'string' && r.label.trim() ? r.label : r.key,
              icon: typeof r.icon === 'string' && r.icon.trim() ? r.icon : null,
            });
            return acc;
          }, []);
          setStarpayMethods(valid);
        }
      })
      .catch(() => { /* probe is best-effort */ })
      .finally(() => { if (alive) setStarpayChecked(true); });

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

  // Promotion claims land here with a database-backed promotion id.
  // Prefill the configured amount, then persist the context when the
  // user submits so approval can apply the exact selected rule.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('source') !== 'promotion') return;
    const promotionId = params.get('promotionId')?.trim() ?? '';
    if (!promotionId) return;
    const amount = Number(params.get('amount') ?? 0);
    const recommendedAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;
    setPromotionIntent({
      promotionId,
      promoCode: params.get('promoCode')?.trim() || null,
      recommendedAmount,
    });
    if (recommendedAmount > 0) {
      setValue('amount', recommendedAmount, { shouldValidate: true });
    }
  }, [setValue]);

  // No default method is auto-selected on mount. Before the Babu88-
  // style tile grid, the page assumed the player would always work
  // through the manual flow, so it auto-picked methods[0] so the
  // SelectedMethodCard + Verification card had a method to render
  // against. After the gateway tiles shipped this auto-pick became
  // a footgun: if methods[0] happened to be the operator's manual
  // Nagad / bKash entry, the manual wallet number popped up the
  // moment the page mounted even though the player had not tapped
  // anything. The operator reported this as a bug. Removing the
  // auto-pick keeps both bottom cards blank until the player
  // explicitly taps a tile.

  const watchedAmount = watch('amount');
  const watchedMethodName = watch('method');
  const method = methods.find((m) => m.name === watchedMethodName);

  // Live bonus preview with 250 ms debounce.
  useEffect(() => {
    const n = Number(watchedAmount) || 0;
    if (previewTimer.current) clearTimeout(previewTimer.current);
    if (n <= 0) {
      setPreview({ bonusPercentage: 0, bonusAmount: 0, totalCredit: 0, promotionName: null });
      return;
    }
    previewTimer.current = setTimeout(() => {
      const params = new URLSearchParams({ amount: String(n) });
      if (promotionIntent?.promotionId) params.set('promotionId', promotionIntent.promotionId);
      fetch(`/api/content/deposit-preview?${params.toString()}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (!j) return;
          setPreview({
            bonusPercentage: Number(j.bonusPercentage) || 0,
            bonusAmount: Number(j.bonusAmount) || 0,
            totalCredit: Number(j.totalCredit) || n,
            promotionName: typeof j.promotionName === 'string' ? j.promotionName : null,
          });
        })
        .catch(() => { /* preview is best-effort */ });
    }, 250);
    return () => { if (previewTimer.current) clearTimeout(previewTimer.current); };
  }, [watchedAmount, promotionIntent?.promotionId]);

  // Map raw schema keys to the visible bilingual field labels so the
  // error summary reads "Transaction ID" / "ট্রানজেকশন আইডি" instead of
  // the internal key "txn".
  const fieldLabel = (field: string): string => {
    if (field === 'amount') return t('deposit.amount');
    if (field === 'method') return t('deposit.method');
    if (field === 'txn') return t('deposit.txn');
    return field;
  };

  const errorEntries = Object.entries(errors).map(([field, e]) => ({
    field,
    label: fieldLabel(field),
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
      announce(
        lang === 'bn' ? 'ডিপোজিট জমা দেওয়ার আগে লগ ইন করুন।' : 'Please log in before submitting a deposit.',
        { tone: 'assertive' },
      );
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
          promotionId: promotionIntent?.promotionId ?? undefined,
          promoCode: promotionIntent?.promoCode ?? undefined,
        }),
      });
      const data = await res.json().catch(() => ({} as Record<string, unknown>));

      if (!res.ok) {
        const code = typeof data?.code === 'string' ? (data.code as string) : null;
        const message = typeof data?.message === 'string' ? (data.message as string) : null;
        // Announce the failure assertively for screen-reader users. The
        // specific reason still renders visibly in the serverError node.
        announce(
          lang === 'bn' ? 'ডিপোজিট রিকোয়েস্ট ব্যর্থ হয়েছে।' : 'Deposit request failed.',
          { tone: 'assertive' },
        );
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
        announce(
          lang === 'bn' ? 'ডিপোজিট গ্রহণ করা হয়েছে কিন্তু কোনো রেফারেন্স আইডি পাওয়া যায়নি।' : 'Deposit was accepted but no reference id was returned.',
          { tone: 'assertive' },
        );
        return;
      }

      setSubmittedDepositId(newId);
      setSubmitted(true);
      announce(
        lang === 'bn' ? 'ডিপোজিট রিকোয়েস্ট জমা হয়েছে। অনুমোদনের অপেক্ষায়।' : 'Deposit request submitted. Pending admin review.',
        { tone: 'polite' },
      );
      triggerWalletRefresh();
    } catch (err) {
      setServerError('Network error. Please check your connection and try again.');
      setServerDetail(err instanceof Error ? err.message : null);
      announce(
        lang === 'bn' ? 'নেটওয়ার্ক ত্রুটি। ডিপোজিট জমা হয়নি।' : 'Network error. Deposit was not submitted.',
        { tone: 'assertive' },
      );
    } finally {
      setLoading(false);
    }
  };

  // Quick Pay click handler. Calls /api/payments/chaopaopay/create-deposit
  // and redirects the player to the ChaopaoPay-hosted bKash/Nagad
  // payment page returned in paymentUrl. The webhook + service layer
  // auto-credit the wallet within ~30 seconds of payment.
  const onExpressPay = useCallback(async (method: 'bkash' | 'nagad') => {
    setExpressError(null);
    setServerError(null);
    setServerDetail(null);

    if (auth.kind !== 'authed') {
      router.push('/?login=1');
      return;
    }
    const amount = Number(watchedAmount) || 0;
    if (amount < 100) {
      setExpressError(lang === 'bn' ? 'নূন্যতম ডিপোজিট ১০০ টাকা।' : 'Minimum deposit is 100 BDT.');
      return;
    }

    setExpressBusy(method);
    try {
      const res = await fetch('/api/payments/chaopaopay/create-deposit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          amount,
          method,
          promotionId: promotionIntent?.promotionId ?? undefined,
          promoCode: promotionIntent?.promoCode ?? undefined,
        }),
      });
      const data = await res.json().catch(() => null) as { paymentUrl?: string; code?: string; message?: string } | null;
      if (!res.ok || !data?.paymentUrl) {
        const msg = data?.message ?? data?.code ?? `Gateway error (${res.status}).`;
        setExpressError(lang === 'bn'
          ? `গেটওয়ে ত্রুটি: ${msg}. নিচের ফর্ম ব্যবহার করে ম্যানুয়াল ডিপোজিট করুন।`
          : `${msg} Please use the manual form below.`);
        return;
      }
      // Hand off to ChaopaoPay's hosted payment page.
      window.location.href = data.paymentUrl;
    } catch (err) {
      setExpressError(lang === 'bn' ? 'নেটওয়ার্ক ত্রুটি। আবার চেষ্টা করুন।' : 'Network error. Please try again.');
    } finally {
      setExpressBusy(null);
    }
  }, [auth.kind, watchedAmount, promotionIntent, router, lang]);

  // ZinIPay hosted-gateway click handler. Posts to the ZinIPay
  // create-deposit route and hands the player off to the hosted page.
  const onZinipayPay = useCallback(async () => {
    setExpressError(null);
    setServerError(null);
    setServerDetail(null);
    if (auth.kind !== 'authed') { router.push('/?login=1'); return; }
    const amount = Number(watchedAmount) || 0;
    if (amount < 100) {
      setExpressError(lang === 'bn' ? 'নূন্যতম ডিপোজিট ১০০ টাকা।' : 'Minimum deposit is 100 BDT.');
      return;
    }
    setZinipayBusy(true);
    try {
      const res = await fetch('/api/payments/zinipay/create-deposit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          amount,
          promotionId: promotionIntent?.promotionId ?? undefined,
          promoCode: promotionIntent?.promoCode ?? undefined,
        }),
      });
      const data = await res.json().catch(() => null) as { paymentUrl?: string; code?: string; message?: string } | null;
      if (!res.ok || !data?.paymentUrl) {
        const msg = data?.message ?? data?.code ?? `Gateway error (${res.status}).`;
        setExpressError(lang === 'bn'
          ? `গেটওয়ে ত্রুটি: ${msg}. নিচের ফর্ম ব্যবহার করে ম্যানুয়াল ডিপোজিট করুন।`
          : `${msg} Please use the manual form below.`);
        return;
      }
      window.location.href = data.paymentUrl;
    } catch {
      setExpressError(lang === 'bn' ? 'নেটওয়ার্ক ত্রুটি। আবার চেষ্টা করুন।' : 'Network error. Please try again.');
    } finally {
      setZinipayBusy(false);
    }
  }, [auth.kind, watchedAmount, promotionIntent, router, lang]);

  // StarPay-backed tile click handler. Posts to the StarPay create-deposit
  // route with the SPECIFIC method the player tapped (bkash / nagad /
  // rocket), which routes to that method's own channel id, and hands the
  // player off to the returned hosted payUrl. StarPay's name never
  // appears in the UI copy - the player only ever sees the brand tile.
  const onStarpayPay = useCallback(async (method: 'bkash' | 'nagad' | 'rocket') => {
    setExpressError(null);
    setServerError(null);
    setServerDetail(null);
    if (auth.kind !== 'authed') { router.push('/?login=1'); return; }
    const amount = Number(watchedAmount) || 0;
    if (amount < 100) {
      setExpressError(lang === 'bn' ? 'নূন্যতম ডিপোজিট ১০০ টাকা।' : 'Minimum deposit is 100 BDT.');
      return;
    }
    setStarpayBusy(method);
    try {
      const res = await fetch('/api/payments/starpay/create-deposit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          amount,
          method,
          promotionId: promotionIntent?.promotionId ?? undefined,
          promoCode: promotionIntent?.promoCode ?? undefined,
        }),
      });
      const data = await res.json().catch(() => null) as { paymentUrl?: string; code?: string; message?: string } | null;
      if (!res.ok || !data?.paymentUrl) {
        const msg = data?.message ?? data?.code ?? `Gateway error (${res.status}).`;
        setExpressError(lang === 'bn'
          ? `গেটওয়ে ত্রুটি: ${msg}. নিচের ফর্ম ব্যবহার করে ম্যানুয়াল ডিপোজিট করুন।`
          : `${msg} Please use the manual form below.`);
        return;
      }
      window.location.href = data.paymentUrl;
    } catch {
      setExpressError(lang === 'bn' ? 'নেটওয়ার্ক ত্রুটি। আবার চেষ্টা করুন।' : 'Network error. Please try again.');
    } finally {
      setStarpayBusy(null);
    }
  }, [auth.kind, watchedAmount, promotionIntent, router, lang]);

  const newRequest = () => {
    setSubmitted(false);
    setSubmittedDepositId(null);
    setProofUrl(null);
    setProofName(null);
    setUploadError(null);
    setServerError(null);
    setServerDetail(null);
    reset({ amount: promotionIntent?.recommendedAmount ?? 0, method: methods[0]?.name ?? '', txn: '' });
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

      {promotionIntent ? (
        <Card padding="md" className="mb-4 border border-emerald-300/60 bg-emerald-50">
          <p className="text-sm font-semibold text-emerald-900">
            {lang === 'bn' ? 'প্রমোশন ডিপোজিট নির্বাচন করা হয়েছে' : 'Promotion deposit selected'}
          </p>
          <p className="mt-1 text-xs text-emerald-800">
            {preview.promotionName
              ? (lang === 'bn' ? `${preview.promotionName} অনুমোদনের পর প্রয়োগ হবে।` : `${preview.promotionName} will be applied after approval.`)
              : (lang === 'bn' ? 'যোগ্য হলে অনুমোদনের পর বোনাস প্রয়োগ হবে।' : 'The bonus will be applied after approval when eligible.')}
          </p>
        </Card>
      ) : null}

      {/* The old big "Express Pay" yellow card was retired in favour
          of the per-method tile grid below. Gateway methods (bKash,
          Nagad) appear as their own tiles alongside the operator's
          manual deposit methods, so the player just taps one icon
          and the page routes to the right flow. */}

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
                <div className="mt-3 rounded-xl border border-emerald-800 bg-gradient-to-br from-emerald-700 to-emerald-800 p-3 text-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-50">
                    {lang === 'bn' ? 'বোনাস প্রিভিউ' : 'Bonus preview'}
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-50">{lang === 'bn' ? 'বোনাস %' : 'Bonus %'}</p>
                      <p className="text-base font-extrabold text-white">{preview.bonusPercentage}%</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-50">{lang === 'bn' ? 'বোনাস' : 'Bonus'}</p>
                      <p className="text-base font-extrabold text-white">+ BDT {preview.bonusAmount.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-emerald-50">{lang === 'bn' ? 'মোট ক্রেডিট' : 'Total credit'}</p>
                      <p className="text-base font-extrabold text-white">BDT {preview.totalCredit.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ) : (Number(watchedAmount) || 0) > 0 ? (
                <p className="mt-2 text-sm font-semibold text-ink-mid">
                  {lang === 'bn' ? 'এই পরিমাণের জন্য সক্রিয় বোনাস টিয়ার নেই।' : 'No active bonus tier matches this amount.'}
                </p>
              ) : null}
            </Card>

            <Card padding="lg">
              <CardHeader
                title={lang === 'bn' ? 'মূল্য পরিশোধ পদ্ধতি' : 'Payment method'}
                subtitle={lang === 'bn'
                  ? 'একটি পদ্ধতি বেছে নিন। বিকাশ ও নগদ অটো-ক্রেডিট, অন্যান্য ম্যানুয়াল অনুমোদন।'
                  : 'Pick a method. bKash and Nagad auto-credit, others go through manual review.'}
              />
              {!methodsLoaded || !expressChecked || !zinipayChecked || !starpayChecked ? (
                <p className="text-sm text-ink-mid">{lang === 'bn' ? 'লোড হচ্ছে...' : 'Loading...'}</p>
              ) : methods.length === 0 && !expressAvailable && !zinipayAvailable && starpayMethods.length === 0 ? (
                // Designed empty state (mirrors the withdraw page): shown
                // when the operator has not configured a single deposit
                // channel yet, so the player knows what to do next
                // instead of staring at an empty tile grid.
                <div className="rounded-xl border border-dashed border-neon/25 bg-base-deep/40 px-4 py-8 text-center">
                  <AlertTriangle className="mx-auto h-6 w-6 text-amber-500" />
                  <p className="mt-3 text-sm font-semibold text-ink-hi">
                    {lang === 'bn' ? 'কোনো ডিপোজিট পদ্ধতি এখনো চালু নেই।' : 'No deposit methods are available yet.'}
                  </p>
                  <p className="mx-auto mt-1 max-w-sm text-xs text-ink-mid">
                    {lang === 'bn'
                      ? 'অপারেটর টিম পেমেন্ট চ্যানেল প্রস্তুত করছে। কিছুক্ষণ পরে আবার চেষ্টা করুন, অথবা সাপোর্ট টিমের সাথে যোগাযোগ করুন।'
                      : 'The team is setting up payment channels. Please check back shortly, or reach out to support and we will help you deposit.'}
                  </p>
                  <Link href="/support" className="mt-4 inline-flex h-9 items-center rounded-lg border border-neon/25 px-4 text-xs font-semibold text-ink-hi hover:border-neon/45">
                    {lang === 'bn' ? 'সাপোর্টে যোগাযোগ করুন' : 'Contact support'}
                  </Link>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {/* Gateway tiles - bKash + Nagad route to ChaopaoPay
                        when the operator has enabled the gateway in
                        /admin/payments. The "AUTO" badge differentiates
                        these from manual methods of the same brand. */}
                    {expressAvailable && expressMethods.includes('bkash') ? (
                      <button
                        type="button"
                        onClick={() => { setGatewayChoice('bkash'); setValue('method', '', { shouldValidate: false }); setExpressError(null); }}
                        className={cn(
                          'group relative flex aspect-square flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl border-2 bg-white p-2 text-center transition active:translate-y-px',
                          gatewayChoice === 'bkash' ? 'border-amber-500 shadow-[0_0_0_3px_rgba(245,180,0,0.18)]' : 'border-transparent hover:border-amber-300/60',
                        )}
                      >
                        {(() => {
                          // Per-method admin override of the badge.
                          // Look up the matching PaymentMethod row by
                          // name, fall back to AUTO when absent.
                          const m = methods.find((x) => x.name.trim().toLowerCase().includes('bkash'));
                          if (m && !m.badgeEnabled) return null;
                          const enLabel = (m?.badgeLabelEn ?? '').trim() || 'AUTO';
                          const bnLabel = (m?.badgeLabelBn ?? '').trim() || 'অটো';
                          return (
                            <span className="absolute right-1 top-1 inline-flex items-center rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider text-emerald-700">
                              {lang === 'bn' ? bnLabel : enLabel}
                            </span>
                          );
                        })()}
                        {expressIcons.bkash ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={expressIcons.bkash}
                            alt="bKash"
                            className="h-11 w-11 rounded-xl object-contain"
                            onError={() => setExpressIcons((s) => ({ ...s, bkash: null }))}
                          />
                        ) : (
                          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e2136e] text-base font-extrabold text-white shadow-sm">
                            bK
                          </span>
                        )}
                        <span className="text-[11px] font-bold text-ink-hi">bKash</span>
                      </button>
                    ) : null}
                    {expressAvailable && expressMethods.includes('nagad') ? (
                      <button
                        type="button"
                        onClick={() => { setGatewayChoice('nagad'); setValue('method', '', { shouldValidate: false }); setExpressError(null); }}
                        className={cn(
                          'group relative flex aspect-square flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl border-2 bg-white p-2 text-center transition active:translate-y-px',
                          gatewayChoice === 'nagad' ? 'border-amber-500 shadow-[0_0_0_3px_rgba(245,180,0,0.18)]' : 'border-transparent hover:border-amber-300/60',
                        )}
                      >
                        {(() => {
                          const m = methods.find((x) => x.name.trim().toLowerCase().includes('nagad'));
                          if (m && !m.badgeEnabled) return null;
                          const enLabel = (m?.badgeLabelEn ?? '').trim() || 'AUTO';
                          const bnLabel = (m?.badgeLabelBn ?? '').trim() || 'অটো';
                          return (
                            <span className="absolute right-1 top-1 inline-flex items-center rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider text-emerald-700">
                              {lang === 'bn' ? bnLabel : enLabel}
                            </span>
                          );
                        })()}
                        {expressIcons.nagad ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={expressIcons.nagad}
                            alt="Nagad"
                            className="h-11 w-11 rounded-xl object-contain"
                            onError={() => setExpressIcons((s) => ({ ...s, nagad: null }))}
                          />
                        ) : (
                          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#ec1c24] text-base font-extrabold text-white shadow-sm">
                            N
                          </span>
                        )}
                        <span className="text-[11px] font-bold text-ink-hi">Nagad</span>
                      </button>
                    ) : null}

                    {/* ZinIPay hosted gateway tile. Player picks the
                        wallet on the ZinIPay page, so there is no
                        per-method branch on our side. */}
                    {zinipayAvailable ? (
                      <button
                        type="button"
                        onClick={() => { setGatewayChoice('zinipay'); setValue('method', '', { shouldValidate: false }); setExpressError(null); }}
                        className={cn(
                          'group relative flex aspect-square flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl border-2 bg-white p-2 text-center transition active:translate-y-px',
                          gatewayChoice === 'zinipay' ? 'border-sky-500 shadow-[0_0_0_3px_rgba(14,165,233,0.18)]' : 'border-transparent hover:border-sky-300/60',
                        )}
                      >
                        <span className="absolute right-1 top-1 inline-flex items-center rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider text-sky-700">
                          {lang === 'bn' ? 'অটো' : 'AUTO'}
                        </span>
                        {zinipayIcon ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={zinipayIcon}
                            alt="ZinIPay"
                            className="h-11 w-11 rounded-xl object-contain"
                            onError={() => setZinipayIcon(null)}
                          />
                        ) : (
                          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-600 text-base font-extrabold text-white shadow-sm">
                            Z
                          </span>
                        )}
                        <span className="text-[11px] font-bold text-ink-hi">ZinIPay</span>
                      </button>
                    ) : null}

                    {/* StarPay-backed tiles - rendered as genuine bKash /
                        Nagad / Rocket brand tiles (StarPay is only the
                        backend gateway and is never named in the UI).
                        Each tile is independently enabled, labeled,
                        iconed and ordered by the operator. Brand colours
                        match the equivalent ChaopaoPay tiles above so a
                        player sees one consistent bKash/Nagad look
                        regardless of which gateway is behind it. */}
                    {starpayMethods.map((sm) => {
                      const choice = `starpay_${sm.key}` as const;
                      const selected = gatewayChoice === choice;
                      const badgeBgClass = sm.key === 'bkash' ? 'bg-[#e2136e]' : sm.key === 'nagad' ? 'bg-[#ec1c24]' : 'bg-violet-600';
                      const badgeLetter = sm.key === 'bkash' ? 'bK' : sm.key === 'nagad' ? 'N' : 'R';
                      const ringClass = sm.key === 'bkash'
                        ? (selected ? 'border-pink-500 shadow-[0_0_0_3px_rgba(226,19,110,0.18)]' : 'border-transparent hover:border-pink-300/60')
                        : sm.key === 'nagad'
                          ? (selected ? 'border-red-500 shadow-[0_0_0_3px_rgba(236,28,36,0.18)]' : 'border-transparent hover:border-red-300/60')
                          : (selected ? 'border-violet-500 shadow-[0_0_0_3px_rgba(124,58,237,0.18)]' : 'border-transparent hover:border-violet-300/60');
                      return (
                        <button
                          key={choice}
                          type="button"
                          onClick={() => { setGatewayChoice(choice); setValue('method', '', { shouldValidate: false }); setExpressError(null); }}
                          className={cn(
                            'group relative flex aspect-square flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl border-2 bg-white p-2 text-center transition active:translate-y-px',
                            ringClass,
                          )}
                        >
                          <span className="absolute right-1 top-1 inline-flex items-center rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider text-emerald-700">
                            {lang === 'bn' ? 'অটো' : 'AUTO'}
                          </span>
                          {sm.icon ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={sm.icon}
                              alt={sm.label}
                              className="h-11 w-11 rounded-xl object-contain"
                              onError={() => setStarpayMethods((list) => list.map((x) => (x.key === sm.key ? { ...x, icon: null } : x)))}
                            />
                          ) : (
                            <span className={cn('flex h-11 w-11 items-center justify-center rounded-xl text-base font-extrabold text-white shadow-sm', badgeBgClass)}>
                              {badgeLetter}
                            </span>
                          )}
                          <span className="text-[11px] font-bold text-ink-hi">{sm.label}</span>
                        </button>
                      );
                    })}

                    {/* Manual method tiles - skip brand duplicates of
                        bKash and Nagad when the gateway is enabled so
                        the player is not presented with two icons
                        that route to different flows for the same
                        brand. Substring match is intentional: the
                        operator's admin labels are usually in Bangla
                        or hybrid ("Nagad ডিপোজিট", "bKash Cash In",
                        "Nagad Send Money") and exact-equality filter
                        let every one of those leak through as a
                        confusing duplicate. */}
                    {methods
                      .filter((m) => {
                        if (!expressAvailable) return true;
                        const n = m.name.trim().toLowerCase();
                        if (expressMethods.includes('bkash') && n.includes('bkash')) return false;
                        if (expressMethods.includes('nagad') && n.includes('nagad')) return false;
                        return true;
                      })
                      .map((m) => {
                        const isSelected = !gatewayChoice && watchedMethodName === m.name;
                        return (
                          <button
                            type="button"
                            key={m.id}
                            onClick={() => { setGatewayChoice(null); setValue('method', m.name, { shouldValidate: true }); }}
                            className={cn(
                              'group relative flex aspect-square flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl border-2 bg-white p-2 text-center transition active:translate-y-px',
                              isSelected ? 'border-amber-500 shadow-[0_0_0_3px_rgba(245,180,0,0.18)]' : 'border-transparent hover:border-amber-300/60',
                            )}
                          >
                            {(() => {
                              if (!m.badgeEnabled) return null;
                              const enLabel = (m.badgeLabelEn ?? '').trim() || 'MANUAL';
                              const bnLabel = (m.badgeLabelBn ?? '').trim() || 'ম্যানুয়াল';
                              return (
                                <span className="absolute right-1 top-1 inline-flex items-center rounded-full bg-brand-surface px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-ink-lo">
                                  {lang === 'bn' ? bnLabel : enLabel}
                                </span>
                              );
                            })()}
                            {m.iconUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={m.iconUrl} alt={m.name} className="h-11 w-11 rounded-xl object-contain" />
                            ) : (
                              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 to-amber-500 text-base font-extrabold text-[#3A1F00] shadow-sm">
                                {m.name.charAt(0).toUpperCase()}
                              </span>
                            )}
                            <span className="truncate max-w-full text-[11px] font-bold text-ink-hi">{m.name}</span>
                          </button>
                        );
                      })}
                  </div>

                  {/* Selected method details. The gateway tiles show a
                      short "redirects to bKash/Nagad" hint; manual
                      tiles render the operator-configured
                      SelectedMethodCard with payment instructions. */}
                  {gatewayChoice === 'zinipay' ? (
                    <div className="mt-4 rounded-xl border border-sky-300/60 bg-sky-50 p-3 text-sm text-sky-900">
                      <p className="font-semibold">
                        {lang === 'bn' ? 'জিনিপে হোস্টেড পেমেন্ট পৃষ্ঠা' : 'ZinIPay hosted payment page'}
                      </p>
                      <p className="mt-1 text-xs">
                        {lang === 'bn'
                          ? 'নিচের "জিনিপেতে পে করুন" বোতাম চাপলে জিনিপে পৃষ্ঠায় চলে যাবেন। সেখানে বিকাশ / নগদ / রকেট বেছে নিয়ে পেমেন্ট করুন। সফল হলে কয়েক সেকেন্ডে ওয়ালেট ক্রেডিট হবে।'
                          : 'Tap the "Pay with ZinIPay" button below to open the secure hosted page, then choose bKash, Nagad or Rocket there. Wallet credits within seconds of a successful payment.'}
                      </p>
                    </div>
                  ) : gatewayChoice === 'starpay_bkash' || gatewayChoice === 'starpay_nagad' || gatewayChoice === 'starpay_rocket' ? (
                    <div className="mt-4 rounded-xl border border-emerald-300/60 bg-emerald-50 p-3 text-sm text-emerald-900">
                      <p className="font-semibold">
                        {lang === 'bn'
                          ? `${gatewayChoice === 'starpay_bkash' ? 'বিকাশ' : gatewayChoice === 'starpay_nagad' ? 'নগদ' : 'রকেট'} পেমেন্ট অটো-ক্রেডিট হবে`
                          : `${gatewayChoice === 'starpay_bkash' ? 'bKash' : gatewayChoice === 'starpay_nagad' ? 'Nagad' : 'Rocket'} payment auto-credits`}
                      </p>
                      <p className="mt-1 text-xs">
                        {lang === 'bn'
                          ? 'নিচের বোতাম চাপলে নিরাপদ পেমেন্ট পৃষ্ঠায় চলে যাবেন। পেমেন্ট সফল হলে কয়েক সেকেন্ডের মধ্যে ওয়ালেট ক্রেডিট হবে।'
                          : 'Tap the button below to open the secure payment page. Wallet credits within seconds of a successful payment.'}
                      </p>
                    </div>
                  ) : gatewayChoice ? (
                    <div className="mt-4 rounded-xl border border-emerald-300/60 bg-emerald-50 p-3 text-sm text-emerald-900">
                      <p className="font-semibold">
                        {lang === 'bn'
                          ? `${gatewayChoice === 'bkash' ? 'বিকাশ' : 'নগদ'} পেমেন্ট অটো-ক্রেডিট হবে`
                          : `${gatewayChoice === 'bkash' ? 'bKash' : 'Nagad'} payment auto-credits`}
                      </p>
                      <p className="mt-1 text-xs">
                        {lang === 'bn'
                          ? `নিচের "${gatewayChoice === 'bkash' ? 'বিকাশে' : 'নগদে'} পে করুন" বোতাম চাপলে ${gatewayChoice === 'bkash' ? 'বিকাশ' : 'নগদ'} পেমেন্ট পৃষ্ঠায় চলে যাবেন। পেমেন্ট সফল হলে ৩০ সেকেন্ডের মধ্যে ওয়ালেট ক্রেডিট হবে।`
                          : `Tap the "${gatewayChoice === 'bkash' ? 'Pay with bKash' : 'Pay with Nagad'}" button below to open the secure payment page. Wallet credits within 30 seconds of successful payment.`}
                      </p>
                    </div>
                  ) : method ? (
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
                  {!gatewayChoice && method?.minDeposit ? (
                    <p className="mt-2 text-xs text-ink-mid">
                      {lang === 'bn' ? 'এই মাধ্যমের সীমা: ' : 'This method: '} Min BDT {method.minDeposit.toLocaleString()}
                      {method.maxDeposit ? ` . Max BDT ${method.maxDeposit.toLocaleString()}` : ''}
                    </p>
                  ) : null}
                  {expressError ? (
                    <p className="mt-2 text-xs font-semibold text-rose-700">{expressError}</p>
                  ) : null}
                </>
              )}
            </Card>

            {/* Verification card is only meaningful for manual
                methods AFTER a method is actually picked. Before the
                player taps a tile, the card stays hidden so the page
                does not advertise the manual TX-ID flow at the
                player who is about to tap bKash for the auto
                gateway. Gateway flow itself never needs TX-ID or
                proof - the webhook signature is the verification. */}
            {!gatewayChoice && method ? (
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
                <p className="mt-2 text-xs text-ink-lo">PNG, JPG, WEBP or PDF, max 8 MB.</p>
              )}
            </Card>
            ) : null}

            {isSubmitted && errorEntries.length > 0 ? (
              <div className="rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <p className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4" /> Please fix the highlighted fields:
                </p>
                <ul className="mt-1 list-disc pl-6">
                  {errorEntries.map((e) => (
                    <li key={e.field}><span className="font-semibold">{e.label}</span> - {e.message}</li>
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

            {/* Action button switches between gateway redirect and
                manual submit based on the currently selected tile.
                Hidden entirely when nothing is picked so the page
                does not show a disabled "Submit Request" button
                before the player has even chosen a method. */}
            {gatewayChoice === 'zinipay' ? (
              <button
                type="button"
                onClick={onZinipayPay}
                disabled={!canSubmit || zinipayBusy || (Number(watchedAmount) || 0) < 100}
                className={cn(
                  'inline-flex h-12 w-full items-center justify-center rounded-xl bg-sky-600 px-5 text-base font-extrabold text-white shadow transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 md:w-auto',
                )}
              >
                {zinipayBusy
                  ? (lang === 'bn' ? 'লোড...' : 'Opening...')
                  : (lang === 'bn'
                      ? `BDT ${(Number(watchedAmount) || 0).toLocaleString()} জিনিপেতে পে করুন`
                      : `Pay BDT ${(Number(watchedAmount) || 0).toLocaleString()} with ZinIPay`)}
              </button>
            ) : gatewayChoice === 'starpay_bkash' || gatewayChoice === 'starpay_nagad' || gatewayChoice === 'starpay_rocket' ? (
              <button
                type="button"
                onClick={() => onStarpayPay(gatewayChoice === 'starpay_bkash' ? 'bkash' : gatewayChoice === 'starpay_nagad' ? 'nagad' : 'rocket')}
                disabled={!canSubmit || !!starpayBusy || (Number(watchedAmount) || 0) < 100}
                className={cn(
                  'inline-flex h-12 w-full items-center justify-center rounded-xl px-5 text-base font-extrabold text-white shadow transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 md:w-auto',
                  gatewayChoice === 'starpay_bkash' ? 'bg-[#e2136e]' : gatewayChoice === 'starpay_nagad' ? 'bg-[#ec1c24]' : 'bg-violet-600',
                )}
              >
                {starpayBusy
                  ? (lang === 'bn' ? 'লোড...' : 'Opening...')
                  : (lang === 'bn'
                      ? `BDT ${(Number(watchedAmount) || 0).toLocaleString()} ${gatewayChoice === 'starpay_bkash' ? 'বিকাশে' : gatewayChoice === 'starpay_nagad' ? 'নগদে' : 'রকেটে'} পে করুন`
                      : `Pay BDT ${(Number(watchedAmount) || 0).toLocaleString()} with ${gatewayChoice === 'starpay_bkash' ? 'bKash' : gatewayChoice === 'starpay_nagad' ? 'Nagad' : 'Rocket'}`)}
              </button>
            ) : gatewayChoice ? (
              <button
                type="button"
                onClick={() => onExpressPay(gatewayChoice)}
                disabled={!canSubmit || !!expressBusy || (Number(watchedAmount) || 0) < 100}
                className={cn(
                  'inline-flex h-12 w-full items-center justify-center rounded-xl px-5 text-base font-extrabold text-white shadow transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 md:w-auto',
                  gatewayChoice === 'bkash' ? 'bg-[#e2136e]' : 'bg-[#ec1c24]',
                )}
              >
                {expressBusy
                  ? (lang === 'bn' ? 'লোড...' : 'Opening...')
                  : (lang === 'bn'
                      ? `BDT ${(Number(watchedAmount) || 0).toLocaleString()} ${gatewayChoice === 'bkash' ? 'বিকাশে' : 'নগদে'} পে করুন`
                      : `Pay BDT ${(Number(watchedAmount) || 0).toLocaleString()} with ${gatewayChoice === 'bkash' ? 'bKash' : 'Nagad'}`)}
              </button>
            ) : method ? (
              <Button type="submit" size="lg" loading={loading} disabled={!canSubmit} className="w-full md:w-auto">
                {t('deposit.submit')}
              </Button>
            ) : (
              <p className="text-sm text-ink-mid">
                {lang === 'bn' ? 'চালিয়ে যেতে উপরে একটি পেমেন্ট পদ্ধতি বেছে নিন।' : 'Pick a payment method above to continue.'}
              </p>
            )}
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
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Hand-rolled dialog keeps the original dark amber bottom-sheet look
  // (dark bg-[#1a1a1a], amber border + "Important notice" label,
  // docked to the bottom on mobile, centered on >=sm) while layering on
  // the accessibility the shared Modal would have given us: an
  // accessible name via aria-labelledby pointing at the title, an
  // Escape-to-close handler, a focus trap that moves focus into the
  // dialog on open and restores it to the trigger on close, and a
  // backdrop click that dismisses. Any way of closing acknowledges the
  // notice so it stays dismissed for the rest of the tab session.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const node = dialogRef.current;
    const focusable = node?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    (focusable ?? node)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onAcknowledge();
        return;
      }
      if (e.key !== 'Tab' || !node) return;
      const items = Array.from(
        node.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('disabled'));
      if (items.length === 0) {
        e.preventDefault();
        node.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !node.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      opener?.focus?.();
    };
  }, [onAcknowledge]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-3 sm:items-center sm:p-6"
      onClick={onAcknowledge}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-amber-400/40 bg-[#1a1a1a] text-white shadow-2xl outline-none"
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
          <p id={titleId} className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
            {lang === 'bn' ? 'গুরুত্বপূর্ণ নোটিশ' : 'Important notice'}
          </p>
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
          <Button variant="gold" className="w-full" onClick={onAcknowledge}>
            {ctaLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
