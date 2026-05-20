import type { GameCategory, GameProvider } from '@/types';

export const mockCategories: GameCategory[] = [
  { id: 'c_hot', slug: 'hot', nameBn: 'হট গেমস', nameEn: 'Hot Games', iconKey: 'flame', status: 'active' },
  { id: 'c_slots', slug: 'slots', nameBn: 'স্লট', nameEn: 'Slots', iconKey: 'slot', status: 'active' },
  { id: 'c_live', slug: 'live-casino', nameBn: 'লাইভ ক্যাসিনো', nameEn: 'Live Casino', iconKey: 'casino', status: 'active' },
  { id: 'c_fish', slug: 'fishing', nameBn: 'ফিশিং', nameEn: 'Fishing', iconKey: 'fish', status: 'active' },
  { id: 'c_sports', slug: 'sports', nameBn: 'স্পোর্টস', nameEn: 'Sports', iconKey: 'sport', status: 'active' },
  { id: 'c_lottery', slug: 'lottery', nameBn: 'লটারি', nameEn: 'Lottery', iconKey: 'ticket', status: 'active' },
  { id: 'c_poker', slug: 'poker', nameBn: 'পোকার', nameEn: 'Poker', iconKey: 'card', status: 'active' },
  { id: 'c_esports', slug: 'esports', nameBn: 'ই-স্পোর্টস', nameEn: 'E-Sports', iconKey: 'esport', status: 'active' },
];

export const mockProviders: GameProvider[] = [
  { id: 'p_dragon', name: 'Dragon Studio', status: 'active' },
  { id: 'p_royal', name: 'Royal Bengal Labs', status: 'active' },
  { id: 'p_emerald', name: 'Emerald Stack', status: 'active' },
  { id: 'p_sapphire', name: 'Sapphire Live', status: 'active' },
  { id: 'p_tiger', name: 'Tiger Reels', status: 'maintenance' },
  { id: 'p_lotus', name: 'Lotus Origin', status: 'active' },
];
