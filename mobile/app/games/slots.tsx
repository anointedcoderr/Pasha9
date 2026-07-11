// Built by Anointed Coder.
//
// Slots grid: the provider catalog locked to the slots category. Brand filter
// chips, real search and Load-more all come from the shared ProviderGrid; the
// category is fixed so the chips row is hidden and only slots are shown.

import { ProviderGrid } from './_components/ProviderGrid';

export default function SlotsScreen() {
  return (
    <ProviderGrid
      title="Slots"
      subtitle="Spin the reels across every studio"
      fixedCategory="slots"
    />
  );
}
