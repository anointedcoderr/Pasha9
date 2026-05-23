// Built by Anointed Coder.
// Custom HOT / NEW inline markers for navigation and game cards.
// These are decorative spans, not reusable Badge components, per the
// project rule against generic badges.

import { Flame } from 'lucide-react';

export function MarkerHot({ label = 'HOT' }: { label?: string }) {
  return (
    <span className="marker-hot" aria-label={label}>
      <Flame className="h-2.5 w-2.5" /> {label}
    </span>
  );
}

export function MarkerNew({ label = 'NEW' }: { label?: string }) {
  return <span className="marker-new" aria-label={label}>{label}</span>;
}
