// Built by Anointed Coder.
//
// Adapter registry. New providers register here and become
// selectable from the /admin/providers add-provider dropdown
// without any change to routes.

import type { ProviderAdapter } from './types';
import { igamingapisAdapter } from './adapters/igamingapis';

const REGISTRY: Record<string, ProviderAdapter> = {
  [igamingapisAdapter.key]: igamingapisAdapter,
};

export function getAdapter(key: string | null | undefined): ProviderAdapter | null {
  if (!key) return null;
  return REGISTRY[key.toLowerCase()] ?? null;
}

export function listAdapters(): Array<{ key: string; label: string }> {
  return Object.values(REGISTRY).map((a) => ({ key: a.key, label: a.label }));
}
