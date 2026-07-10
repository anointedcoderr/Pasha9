// Built by Anointed Coder.
// Game categories for the CategoryCircle strip. `icon` is an Ionicons glyph
// name; `tone` selects the circle gradient in CategoryCircle.

export type CategoryTone = 'gold' | 'hot' | 'blue' | 'violet' | 'teal' | 'orange' | 'cyan';

export interface GameCategory {
  key: string;
  label: string;
  /** Ionicons glyph name. */
  icon: string;
  tone: CategoryTone;
  route: string;
}

export const mockCategories: GameCategory[] = [
  { key: 'jackpot', label: 'Jackpot', icon: 'diamond', tone: 'gold', route: '/games' },
  { key: 'hot', label: 'Hot', icon: 'flame', tone: 'hot', route: '/games' },
  { key: 'slot', label: 'Slot', icon: 'apps', tone: 'violet', route: '/games' },
  { key: 'casino', label: 'Casino', icon: 'tv', tone: 'blue', route: '/games' },
  { key: 'crash', label: 'Crash', icon: 'flash', tone: 'orange', route: '/games' },
  { key: 'sports', label: 'Sports', icon: 'football', tone: 'teal', route: '/sports' },
  { key: 'fishing', label: 'Fishing', icon: 'fish', tone: 'cyan', route: '/games' },
  { key: 'table', label: 'Table', icon: 'grid', tone: 'gold', route: '/games' },
];
