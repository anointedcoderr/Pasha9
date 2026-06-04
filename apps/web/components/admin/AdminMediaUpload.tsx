// Built by Anointed Coder.
//
// Reusable admin media upload control. Drop into any admin form that
// previously asked the operator to paste an image URL. Posts to the
// existing POST /api/admin/uploads endpoint with a category, shows a
// live preview, and exposes Replace + Remove controls. The parent
// owns the value and gets onChange(url) every time the value changes.
//
// Server validation (MIME + size) lives in lib/uploads/storage.ts so
// the operator cannot bypass limits by editing the form, and the
// returned /uploads/<category>/<file> URL is the canonical value
// stored on the model.

'use client';

import { useRef, useState } from 'react';
import { Upload, Image as ImageIcon, X, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export type UploadCategory =
  | 'banners'
  | 'banners_mobile'
  | 'games'
  | 'branding'
  | 'categories'
  | 'jackpot'
  | 'promo_desktop'
  | 'promo_mobile'
  | 'promo_thumbnail'
  | 'promo_background'
  | 'ambassadors'
  | 'sponsors'
  | 'payment_icons'
  | 'provider_banners'
  | 'avatars';

export interface AdminMediaUploadProps {
  label: string;
  hint?: string;
  value: string | null | undefined;
  category: UploadCategory;
  onChange: (url: string | null) => void;
  required?: boolean;
  className?: string;
  previewClassName?: string;
  accept?: string;
  // Optional rendered hint about expected dimensions / MIME / max
  // size. The server still enforces the canonical limits in
  // lib/uploads/storage.ts.
  constraintHint?: string;
}

const ACCEPT_BY_CATEGORY: Record<UploadCategory, string> = {
  banners: 'image/png,image/jpeg,image/webp',
  banners_mobile: 'image/png,image/jpeg,image/webp',
  games: 'image/png,image/jpeg,image/webp',
  branding: 'image/png,image/jpeg,image/webp,image/svg+xml',
  categories: 'image/png,image/jpeg,image/webp,image/svg+xml',
  jackpot: 'image/png,image/jpeg,image/webp,image/svg+xml',
  promo_desktop: 'image/png,image/jpeg,image/webp',
  promo_mobile: 'image/png,image/jpeg,image/webp',
  promo_thumbnail: 'image/png,image/jpeg,image/webp',
  promo_background: 'image/png,image/jpeg,image/webp',
  ambassadors: 'image/png,image/jpeg,image/webp,image/svg+xml',
  sponsors: 'image/png,image/jpeg,image/webp,image/svg+xml',
  payment_icons: 'image/png,image/jpeg,image/webp,image/svg+xml',
  provider_banners: 'image/png,image/jpeg,image/webp',
  avatars: 'image/png,image/jpeg,image/webp',
};

export function AdminMediaUpload({
  label,
  hint,
  value,
  category,
  onChange,
  required,
  className,
  previewClassName,
  accept,
  constraintHint,
}: AdminMediaUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  const openPicker = () => {
    inputRef.current?.click();
  };

  const onFile = async (file: File | null | undefined) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    setImgFailed(false);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('category', category);
      const res = await fetch('/api/admin/uploads', { method: 'POST', body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Upload failed');
      if (typeof data?.url === 'string' && data.url.length > 0) {
        onChange(data.url);
      } else {
        throw new Error('Upload returned no URL');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const onRemove = () => {
    onChange(null);
    setError(null);
    setImgFailed(false);
  };

  const showPreview = value && !imgFailed;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-[11px] font-bold uppercase tracking-wider text-brand-inkMute">
          {label}
          {required ? <span className="ml-1 text-brand-yellow-700">*</span> : null}
        </label>
        {constraintHint ? (
          <span className="text-[10px] text-brand-inkMute">{constraintHint}</span>
        ) : null}
      </div>

      <div className={cn('flex flex-wrap items-center gap-3 rounded-xl border border-brand-divider bg-brand-paper p-2.5', previewClassName)}>
        <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-brand-divider bg-brand-surface">
          {showPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value ?? ''}
              alt=""
              onError={() => setImgFailed(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <ImageIcon className="h-6 w-6 text-brand-inkMute" />
          )}
          {uploading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-brand-paper/80">
              <Loader2 className="h-5 w-5 animate-spin text-brand-yellow-700" />
            </div>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-brand-ink">
            {value ? value : <span className="text-brand-inkMute">No file selected.</span>}
          </p>
          {hint ? <p className="mt-0.5 text-[11px] text-brand-inkMute">{hint}</p> : null}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={openPicker}
            disabled={uploading}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-brand-divider bg-brand-surface px-2.5 text-[11px] font-bold uppercase tracking-wider text-brand-ink hover:bg-brand-paper disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5" />
            {value ? 'Replace' : 'Upload'}
          </button>
          {value ? (
            <button
              type="button"
              onClick={onRemove}
              disabled={uploading}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-300/40 bg-rose-500/10 px-2.5 text-[11px] font-bold uppercase tracking-wider text-rose-200 hover:bg-rose-500/20 disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" />
              Remove
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-1.5 rounded-lg border border-rose-300/40 bg-rose-500/10 px-2.5 py-1.5">
          <AlertTriangle className="mt-[1px] h-3.5 w-3.5 shrink-0 text-rose-200" />
          <p className="text-[11px] text-rose-100">{error}</p>
        </div>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept={accept ?? ACCEPT_BY_CATEGORY[category]}
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
    </div>
  );
}
