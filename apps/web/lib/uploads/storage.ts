// Built by Anointed Coder.
// Local disk upload adapter. Stores files under UPLOAD_ROOT (default ./uploads in dev,
// /var/www/pasha9/uploads in prod). Nginx serves /uploads/* from the same root.

import { mkdir, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { nanoid } from 'nanoid';

const ROOT = process.env.UPLOAD_ROOT ?? (process.env.NODE_ENV === 'production' ? '/var/www/pasha9/uploads' : './uploads');

export type UploadCategory =
  | 'banners'
  | 'banners_mobile'
  | 'games'
  | 'payment-proofs'
  | 'apk'
  | 'branding'
  | 'categories'
  | 'jackpot'
  // M4 Phase D additions. Each ships with a matching UploadConstraint
  // row so the reusable <ImageUpload> widget enforces dimensions.
  | 'promo_desktop'
  | 'promo_mobile'
  | 'promo_thumbnail'
  | 'promo_background'
  | 'ambassadors'
  | 'sponsors'
  | 'payment_icons'
  | 'provider_banners'
  | 'avatars'
  // Premium atelier additions.
  | 'sounds'
  | 'atelier';

const IMG = new Set(['image/png', 'image/jpeg', 'image/webp']);
const IMG_PLUS_SVG = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);
const AUDIO = new Set(['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/webm']);

const MIME_BY_CATEGORY: Record<UploadCategory, Set<string>> = {
  banners: IMG,
  banners_mobile: IMG,
  games: IMG,
  'payment-proofs': new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf']),
  apk: new Set(['application/vnd.android.package-archive', 'application/octet-stream']),
  branding: IMG_PLUS_SVG,
  categories: IMG_PLUS_SVG,
  jackpot: IMG_PLUS_SVG,
  promo_desktop: IMG,
  promo_mobile: IMG,
  promo_thumbnail: IMG,
  promo_background: IMG,
  ambassadors: IMG_PLUS_SVG,
  sponsors: IMG_PLUS_SVG,
  payment_icons: IMG_PLUS_SVG,
  provider_banners: IMG,
  avatars: IMG,
  sounds: AUDIO,
  atelier: IMG_PLUS_SVG,
};

const MAX_BYTES_BY_CATEGORY: Record<UploadCategory, number> = {
  banners: 4 * 1024 * 1024,
  banners_mobile: 3 * 1024 * 1024,
  games: 4 * 1024 * 1024,
  'payment-proofs': 8 * 1024 * 1024,
  apk: 80 * 1024 * 1024,
  branding: 2 * 1024 * 1024,
  categories: 1 * 1024 * 1024,
  jackpot: 2 * 1024 * 1024,
  promo_desktop: 3 * 1024 * 1024,
  promo_mobile: 2 * 1024 * 1024,
  promo_thumbnail: 1 * 1024 * 1024,
  promo_background: 4 * 1024 * 1024,
  ambassadors: 1 * 1024 * 1024,
  sponsors: 1 * 1024 * 1024,
  payment_icons: 512 * 1024,
  provider_banners: 3 * 1024 * 1024,
  avatars: 2 * 1024 * 1024,
  sounds: 256 * 1024,
  atelier: 4 * 1024 * 1024,
};

const EXT_BY_MIME: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'application/pdf': '.pdf',
  'application/vnd.android.package-archive': '.apk',
  'application/octet-stream': '.apk',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'audio/ogg': '.ogg',
  'audio/wav': '.wav',
  'audio/webm': '.weba',
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
