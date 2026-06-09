// Built by Anointed Coder.
//
// Sound-specific variant of AdminMediaUpload: posts to the same
// /api/admin/uploads endpoint with category="sounds" but renders an
// HTML5 audio preview instead of an <img> thumbnail.

'use client';

import { useRef, useState } from 'react';
import { Upload, Music as MusicIcon, Loader2, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface Props {
  label: string;
  description?: string;
  value: string | null;
  onChange: (url: string | null) => void;
  className?: string;
}

export function AdminSoundUpload({ label, description, value, onChange, className }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openPicker = () => inputRef.current?.click();

  const onFile = async (file: File | null | undefined) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('category', 'sounds');
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

  return (
    <div className={cn('rounded-xl border border-brand-divider bg-brand-paper p-4 space-y-3', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-brand-ink">{label}</p>
          {description ? <p className="mt-0.5 text-[11px] text-brand-inkMute">{description}</p> : null}
        </div>
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-yellow-500/15 text-brand-yellow-700">
          <MusicIcon className="h-4 w-4" />
        </span>
      </div>

      {value ? (
        <div className="space-y-2">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio
            src={value}
            controls
            preload="metadata"
            className="w-full"
          />
          <p className="truncate text-[10px] text-brand-inkMute" title={value}>{value}</p>
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-brand-divider px-3 py-3 text-center text-[11px] text-brand-inkMute">
          No sound uploaded. This slot stays silent.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="audio/mpeg,audio/mp4,audio/ogg,audio/wav,audio/webm"
          onChange={(e) => onFile(e.target.files?.[0])}
          className="hidden"
        />
        <button
          type="button"
          onClick={openPicker}
          disabled={uploading}
          className="btn-yellow inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          {value ? 'Replace' : 'Upload'}
        </button>
        {value ? (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-brand-divider bg-brand-paper px-3 text-xs font-semibold text-brand-inkMute hover:border-brand-yellow-500 hover:text-brand-ink"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </button>
        ) : null}
        <span className="text-[10px] text-brand-inkMute">
          Max 250KB. OGG / MP3 / WAV / M4A / WebM.
        </span>
      </div>

      {error ? (
        <p className="inline-flex items-center gap-1.5 text-[11px] text-rose-700">
          <AlertTriangle className="h-3 w-3" /> {error}
        </p>
      ) : null}
    </div>
  );
}
