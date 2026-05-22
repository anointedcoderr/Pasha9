// Built by Anointed Coder.
// Local disk upload adapter. Stores files under UPLOAD_ROOT (default ./uploads in dev,
// /var/www/pasha9/uploads in prod). Nginx serves /uploads/* from the same root.

import { mkdir, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { nanoid } from 'nanoid';

const ROOT = process.env.UPLOAD_ROOT ?? (process.env.NODE_ENV === 'production' ? '/var/www/pasha9/uploads' : './uploads');

export type UploadCategory = 'banners' | 'games' | 'payment-proofs' | 'apk';

const MIME_BY_CATEGORY: Record<UploadCategory, Set<string>> = {
  banners: new Set(['image/png', 'image/jpeg', 'image/webp']),
  games: new Set(['image/png', 'image/jpeg', 'image/webp']),
  'payment-proofs': new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf']),
  apk: new Set(['application/vnd.android.package-archive', 'application/octet-stream']),
};

const MAX_BYTES_BY_CATEGORY: Record<UploadCategory, number> = {
  banners: 4 * 1024 * 1024,
  games: 4 * 1024 * 1024,
  'payment-proofs': 8 * 1024 * 1024,
  apk: 80 * 1024 * 1024,
};

const EXT_BY_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
  'application/vnd.android.package-archive': '.apk',
  'application/octet-stream': '.apk',
};

function sanitiseStem(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, 40) || 'file';
}

export async function storeFile(category: UploadCategory, file: File): Promise<{ url: string; path: string; bytes: number }> {
  const mime = file.type || 'application/octet-stream';
  if (!MIME_BY_CATEGORY[category].has(mime)) {
    throw new Error(`Unsupported MIME type "${mime}" for ${category}`);
  }
  if (file.size > MAX_BYTES_BY_CATEGORY[category]) {
    throw new Error(`File too large. Maximum ${Math.round(MAX_BYTES_BY_CATEGORY[category] / 1024 / 1024)} MB.`);
  }

  const ext = EXT_BY_MIME[mime] ?? extname(file.name) ?? '';
  const stem = sanitiseStem(file.name.replace(/\.[^.]+$/, ''));
  const filename = `${nanoid(12)}-${stem}${ext}`;
  const dir = join(ROOT, category);
  await mkdir(dir, { recursive: true });
  const absPath = join(dir, filename);
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(absPath, buf);

  return {
    url: `/uploads/${category}/${filename}`,
    path: absPath,
    bytes: buf.length,
  };
}
