// Built by Anointed Coder.
//
// YouTube URL parser. Accepts every common youtube share format and
// returns the 11-char video id, or null when the input is not a
// recognisable YouTube link. Used by the homepage video admin so a
// bad URL fails validation before it ever lands in the DB.

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

function isValidId(value: string | null): value is string {
  if (!value) return false;
  return /^[a-zA-Z0-9_-]{6,15}$/.test(value);
}

export function parseYouTubeVideoId(raw: string): string | null {
  const input = raw.trim();
  if (!input) return null;

  // Pure id, no URL wrapper.
  if (isValidId(input)) return input;

  try {
    const url = new URL(input);
    if (!YOUTUBE_HOSTS.has(url.hostname.toLowerCase())) return null;

    // youtu.be/<id>
    if (url.hostname.toLowerCase().endsWith('youtu.be')) {
      const id = url.pathname.replace(/^\/+/, '').split('/')[0];
      return isValidId(id) ? id : null;
    }

    // youtube.com/watch?v=<id>
    const v = url.searchParams.get('v');
    if (isValidId(v)) return v;

    // youtube.com/embed/<id>, /shorts/<id>, /v/<id>, /live/<id>
    const parts = url.pathname.split('/').filter(Boolean);
    for (const segment of ['embed', 'shorts', 'v', 'live']) {
      const idx = parts.indexOf(segment);
      if (idx >= 0 && parts[idx + 1] && isValidId(parts[idx + 1])) return parts[idx + 1];
    }
  } catch {
    return null;
  }
  return null;
}

export function youtubeThumbnailUrl(videoId: string, quality: 'default' | 'hq' | 'maxres' = 'hq'): string {
  const file = quality === 'maxres' ? 'maxresdefault.jpg' : quality === 'default' ? 'default.jpg' : 'hqdefault.jpg';
  return `https://img.youtube.com/vi/${videoId}/${file}`;
}

export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}?rel=0`;
}
