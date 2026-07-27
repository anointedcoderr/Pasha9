// Built by Anointed Coder.
//
// Active announcement popups for the app (#9). Mirrors the web contract from
// GET /api/content/popups: a targeting-aware list where each popup carries a
// target (which screen/action), a frequency, and optional image + voice audio.
// The AppPopups component decides which one to show for the current route.

import { useQuery } from '@tanstack/react-query';
import { api } from './client';
import { useAuth } from '@/store/auth';

export interface PopupItem {
  id: string;
  title: string;
  body: string;
  ctaLabel: string | null;
  ctaHref: string | null;
  target: string;
  targetUrl: string | null;
  frequency: string;
  imageUrl: string | null;
  audioUrl: string | null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

export async function getPopups(): Promise<PopupItem[]> {
  const res = await api.get<{ ok: true; popups?: Array<Record<string, unknown>> }>('/api/content/popups');
  const rows = Array.isArray(res.popups) ? res.popups : [];
  return rows
    .map((r) => ({
      id: String(r.id ?? ''),
      title: typeof r.title === 'string' ? r.title : '',
      body: typeof r.body === 'string' ? r.body : '',
      ctaLabel: str(r.ctaLabel),
      ctaHref: str(r.ctaHref),
      target: typeof r.target === 'string' ? r.target : 'entry',
      targetUrl: str(r.targetUrl),
      frequency: typeof r.frequency === 'string' ? r.frequency : 'always',
      imageUrl: str(r.imageUrl),
      audioUrl: str(r.audioUrl),
    }))
    .filter((p) => p.id.length > 0 && p.title.length > 0);
}

export function usePopups() {
  const { status } = useAuth();
  return useQuery<PopupItem[]>({
    queryKey: ['popups'],
    queryFn: getPopups,
    enabled: status === 'authed',
    staleTime: 60_000,
  });
}
