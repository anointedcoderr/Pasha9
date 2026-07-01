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
  | 'atelier'
  // Banner hero video files. Stored as-is (never image-processed) so the
  // HeroSlider can play an operator-uploaded MP4 / WebM.
  | 'banner_videos';

const IMG = new Set(['image/png', 'image/jpeg', 'image/webp']);
const IMG_PLUS_SVG = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);
const AUDIO = new Set(['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/webm']);
const VIDEO = new Set(['video/mp4', 'video/webm']);

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
  banner_videos: VIDEO,
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
  banner_videos: 20 * 1024 * 1024,
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
  'video/mp4': '.mp4',
  'video/webm': '.webm',
};

// Max output width per category. Anything wider gets downscaled; smaller
// uploads pass through untouched (withoutEnlargement). Drives the "icons
// and banners appear broken for a few seconds on first paint" fix. The
// previous pipeline served a 4MB DSLR JPEG verbatim, which any 3G/4G
// connection chewed on for seconds. Width here is the visible deployed
// width at 2x DPR (so 1600 covers a desktop hero on a Retina screen).
const RESIZE_MAX_WIDTH: Partial<Record<UploadCategory, number>> = {
  banners: 1600,
  banners_mobile: 900,
  games: 800,
  branding: 1024,
  categories: 256,
  jackpot: 1200,
  promo_desktop: 1400,
  promo_mobile: 700,
  promo_thumbnail: 400,
  promo_background: 1600,
  ambassadors: 600,
  sponsors: 400,
  payment_icons: 256,
  provider_banners: 1200,
  avatars: 400,
  atelier: 1600,
};

// Raster image MIMEs that Sharp can decode + re-encode to WebP. SVG
// stays as-is (already vector). PDFs / APKs / audio are not images.
const RASTER_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);

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

  let ext = EXT_BY_MIME[mime] ?? extname(file.name) ?? '';
  const stem = sanitiseStem(file.name.replace(/\.[^.]+$/, ''));
  const dir = join(ROOT, category);
  await mkdir(dir, { recursive: true });
  const rawBuf = Buffer.from(await file.arrayBuffer());

  // Raster images get resized + re-encoded to WebP at upload time.
  // Skip if sharp is not installed (graceful fallback so dev / CI
  // without native deps still works) or if encoding fails for any
  // reason, the original bytes are written instead. SVG/PDF/APK pass
  // through untouched.
  const maxW = RESIZE_MAX_WIDTH[category];
  let outBuf: Buffer = rawBuf;
  if (maxW && RASTER_MIME.has(mime)) {
    try {
      const sharpMod = await import('sharp');
      const sharp = (sharpMod as { default?: typeof import('sharp') }).default ?? (sharpMod as unknown as typeof import('sharp'));
      const processed = await sharp(rawBuf)
        .rotate()
        .resize({ width: maxW, withoutEnlargement: true })
        .webp({ quality: 82, effort: 4 })
        .toBuffer();
      outBuf = Buffer.from(processed);
      ext = '.webp';
    } catch (err) {
      console.error(`[uploads] sharp optimization failed for ${category}, saving original:`, err);
    }
  }

  const filename = `${nanoid(12)}-${stem}${ext}`;
  const absPath = join(dir, filename);
  await writeFile(absPath, outBuf);

  return {
    url: `/uploads/${category}/${filename}`,
    path: absPath,
    bytes: outBuf.length,
  };
}
