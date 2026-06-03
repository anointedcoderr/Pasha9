// Built by Anointed Coder.
//
// Reusable admin image uploader. M4 Phase D ships this as the canonical
// image field for promotion banners + terms uploads, with the dimension
// / format / size constraints driven by the UploadConstraint row whose
// `categoryKey` matches the storage category.
//
// Behaviour:
//   - Loads the constraint via /api/admin/upload-constraints/[key] on mount.
//   - Renders the required dimensions, accepted MIME list, max bytes, and
//     EN/BN helper note inline above the picker.
//   - Validates MIME, byte size and pixel dimensions client-side before
//     hitting the network. Wrong type / wrong dimensions show a clear
//     warning instead of POSTing the file.
//   - Posts to /api/admin/uploads (existing endpoint) with the category
//     key as the storage bucket. On success calls onChange with the
//     /uploads/<...> URL the upstream returns.
//   - Shows a 96x60 preview of the current URL and a Remove button that
//     clears the field (onChange(null)).
//
// The widget never accepts arbitrary external URLs. The "URL only" mode
// behind a `allowExternalUrl` prop is reserved for future use; today
// every banner / thumbnail / icon is stored under /uploads/.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, X, AlertTriangle, Image as ImageIcon, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface UploadConstraint {
  categoryKey: string;
  label: string;
  requiredWidth: number | null;
  requiredHeight: number | null;
  acceptedMime: string;
  maxBytes: number;
  noteEn: string | null;
  noteBn: string | null;
  fallback: boolean;
}

interface Props {
  categoryKey: string;
  value: string | null;
  onChange: (url: string | null) => void;
  lang?: 'en' | 'bn';
  label?: string;
  disabled?: boolean;
}

function bytesToReadable(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

async function readImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return null;
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error('Image could not be decoded.'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function ImageUpload({ categoryKey, value, onChange, lang = 'en', label, disabled }: Props) {
  const [constraint, setConstraint] = useState<UploadConstraint | null>(null);
  const [busy, setBusy] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/upload-constraints/${encodeURIComponent(categoryKey)}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && j?.constraint) setConstraint(j.constraint as UploadConstraint); })
      .catch(() => { /* fallback to defaults */ });
    return () => { alive = false; };
  }, [categoryKey]);

  const accept = constraint?.acceptedMime ?? 'image/png,image/jpeg,image/webp';
  const acceptedSet = new Set(accept.split(',').map((s) => s.trim()).filter(Boolean));

  const handle = useCallback(async (file: File | null) => {
    setWarning(null);
    if (!file) return;
    if (!acceptedSet.has(file.type)) {
      setWarning(`Unsupported file type "${file.type}". Allowed: ${accept}`);
      return;
    }
    if (constraint && file.size > constraint.maxBytes) {
      setWarning(`File is ${bytesToReadable(file.size)}. Max ${bytesToReadable(constraint.maxBytes)}.`);
      return;
    }
    if (constraint?.requiredWidth && constraint?.requiredHeight) {
      try {
        const dims = await readImageDimensions(file);
        if (dims && (dims.width !== constraint.requiredWidth || dims.height !== constraint.requiredHeight)) {
          setWarning(
            `Image is ${dims.width}x${dims.height}. Required ${constraint.requiredWidth}x${constraint.requiredHeight}. Resize and try again.`,
          );
          return;
        }
      } catch {
        setWarning('Could not read image dimensions. Check the file is a real image.');
        return;
      }
    }

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('category', categoryKey);
      const r = await fetch('/api/admin/uploads', { method: 'POST', body: fd, credentials: 'include' });
      const j = await r.json().catch(() => null);
      if (!r.ok) {
        const code = j?.code as string | undefined;
        const msg = j?.message as string | undefined;
        setWarning(msg ?? code ?? `Upload failed (HTTP ${r.status}).`);
        return;
      }
      const url = (j?.url ?? j?.path ?? j?.proofUrl) as string | undefined;
      if (!url) {
        setWarning('Upload succeeded but no URL was returned.');
        return;
      }
      onChange(url);
    } catch (e) {
      setWarning(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [acceptedSet, accept, constraint, categoryKey, onChange]);

  const note = constraint ? (lang === 'bn' && constraint.noteBn ? constraint.noteBn : constraint.noteEn) : null;
  const reqLabel = constraint?.requiredWidth && constraint?.requiredHeight
    ? `${constraint.requiredWidth}x${constraint.requiredHeight} px`
    : 'Any size';

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-brand-inkMute">
        <ImageIcon className="h-3.5 w-3.5" />
        <span>{label ?? constraint?.label ?? categoryKey}</span>
        <span className="rounded-full border border-brand-divider px-1.5 py-0.5 text-brand-inkSoft">{reqLabel}</span>
        <span className="rounded-full border border-brand-divider px-1.5 py-0.5 text-brand-inkSoft">{accept.replace(/image\//g, '').replace(/,/g, ' ')}</span>
        <span className="rounded-full border border-brand-divider px-1.5 py-0.5 text-brand-inkSoft">max {constraint ? bytesToReadable(constraint.maxBytes) : '4 MB'}</span>
        {constraint?.fallback ? (
          <span className="rounded-full border border-amber-400/60 bg-amber-300/15 px-1.5 py-0.5 text-amber-300">
            constraint missing, defaults applied
          </span>
        ) : null}
      </div>

      {note ? <p className="text-[11px] text-brand-inkMute">{note}</p> : null}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-brand-divider bg-brand-surface">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="preview" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-5 w-5 text-brand-inkMute" />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className={cn(
            'inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-brand-divider bg-brand-paper px-3 text-sm text-brand-inkSoft hover:border-brand-yellow-500 hover:text-brand-ink',
            (busy || disabled) && 'pointer-events-none opacity-60',
          )}>
            <Upload className="h-4 w-4" />
            {busy ? (lang === 'bn' ? 'আপলোড হচ্ছে...' : 'Uploading...') : value ? (lang === 'bn' ? 'বদলান' : 'Replace') : (lang === 'bn' ? 'আপলোড' : 'Upload')}
            <input
              ref={fileRef}
              type="file"
              accept={accept}
              className="hidden"
              disabled={busy || disabled}
              onChange={(e) => handle(e.target.files?.[0] ?? null)}
            />
          </label>
          {value ? (
            <>
              <a
                href={value}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-brand-divider bg-brand-paper px-3 text-[12px] text-brand-inkSoft hover:text-brand-ink"
              >
                {lang === 'bn' ? 'প্রিভিউ' : 'Open'} <ExternalLink className="h-3 w-3" />
              </a>
              <button
                type="button"
                onClick={() => onChange(null)}
                disabled={busy || disabled}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 text-[12px] text-rose-300 hover:text-rose-100"
              >
                <X className="h-3 w-3" /> {lang === 'bn' ? 'মুছুন' : 'Clear'}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {warning ? (
        <p className="flex items-start gap-1 text-[11px] text-rose-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{warning}</span>
        </p>
      ) : null}
    </div>
  );
}
