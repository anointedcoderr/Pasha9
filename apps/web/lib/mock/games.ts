import type { Game } from '@/types';

const titles = [
  ['Bengal Tiger Spin', 'বেঙ্গল টাইগার স্পিন', 'royal'],
  ['Royal Dragon Gold', 'রয়্যাল ড্রাগন গোল্ড', 'gold'],
  ['Lotus Fortune', 'লোটাস ফরচুন', 'neon'],
  ['Padma River Drop', 'পদ্মা রিভার ড্রপ', 'neon'],
  ['Sundarban Hunter', 'সুন্দরবন হান্টার', 'royal'],
  ['Crown of Dhaka', 'ক্রাউন অফ ঢাকা', 'gold'],
  ['Emerald Vault 7', 'এমেরাল্ড ভল্ট ৭', 'neon'],
  ['Lucky Sapphire', 'লাকি স্যাফায়ার', 'royal'],
  ['Money Tree Tilt', 'মানি ট্রি টিল্ট', 'gold'],
  ['Sunrise Roulette', 'সানরাইজ রুলেট', 'red'],
  ['Live Andar Bahar', 'লাইভ আন্দর বাহার', 'red'],
  ['Live Teen Patti', 'লাইভ তিন পত্তি', 'gold'],
  ['Live Baccarat Royal', 'লাইভ ব্যাকারাট রয়্যাল', 'royal'],
  ['Dragon Tiger Live', 'ড্রাগন টাইগার লাইভ', 'red'],
  ['Sic Bo Bonanza', 'সিক বো বোনানজা', 'neon'],
  ['Aviator Sky', 'এভিয়েটর স্কাই', 'neon'],
  ['Plinko Storm', 'প্লিংকো স্টর্ম', 'gold'],
  ['Mines Hunter', 'মাইনস হান্টার', 'red'],
  ['Crash Express', 'ক্র্যাশ এক্সপ্রেস', 'neon'],
  ['Big Bass Hunt', 'বিগ বাস হান্ট', 'royal'],
  ['Ocean Reef King', 'ওশান রীফ কিং', 'neon'],
  ['Deep Sea Cannon', 'ডিপ সি ক্যানন', 'royal'],
  ['Pearl Fortune', 'পার্ল ফরচুন', 'gold'],
  ['Shark Reels', 'শার্ক রিলস', 'red'],
  ['Cricket Champion', 'ক্রিকেট চ্যাম্পিয়ন', 'neon'],
  ['Football Star Bet', 'ফুটবল স্টার বেট', 'gold'],
  ['Volley Smash', 'ভলি স্ম্যাশ', 'royal'],
  ['Esports Arena 5v5', 'ই-স্পোর্টস ৫ বনাম ৫', 'neon'],
  ['Battle Royale Bet', 'ব্যাটল রয়্যাল বেট', 'red'],
  ['Lotto Lucky 6', 'লোটো লাকি ৬', 'gold'],
  ['Mega Draw Friday', 'মেগা ড্র শুক্রবার', 'royal'],
  ['Numbers Rush', 'নাম্বারস রাশ', 'neon'],
  ['Texas Hold Pro', 'টেক্সাস হোল্ড প্রো', 'gold'],
  ['Omaha Royale', 'ওমাহা রয়্যাল', 'royal'],
  ['Five Card Draw', 'ফাইভ কার্ড ড্র', 'neon'],
  ['Diamond Strike', 'ডায়মন্ড স্ট্রাইক', 'gold'],
  ['Phoenix Reels', 'ফিনিক্স রিলস', 'red'],
  ['Jungle Spin Lord', 'জাঙ্গল স্পিন লর্ড', 'royal'],
  ['Temple of Riches', 'টেম্পল অফ রিচেস', 'gold'],
  ['Cosmic Wins', 'কসমিক উইনস', 'neon'],
] as const;

const categoriesByIndex = (i: number) => {
  if (i < 8) return 'c_slots';
  if (i < 14) return 'c_live';
  if (i < 19) return 'c_hot';
  if (i < 24) return 'c_fish';
  if (i < 28) return 'c_sports';
  if (i < 30) return 'c_esports';
  if (i < 33) return 'c_lottery';
  if (i < 36) return 'c_poker';
  return 'c_slots';
};

const providersByIndex = (i: number) => {
  const list = ['p_dragon', 'p_royal', 'p_emerald', 'p_sapphire', 'p_tiger', 'p_lotus'];
  return list[i % list.length];
};

export const mockGames: Game[] = titles.map(([name, nameBn, accent], i) => ({
  id: `g_${String(i + 1).padStart(3, '0')}`,
  name: name as string,
  nameBn: nameBn as string,
  categoryId: categoriesByIndex(i),
  providerId: providersByIndex(i),
  accent: accent as Game['accent'],
  iconKey: `game-${(i % 6) + 1}`,
  isFeatured: i < 12 || i % 7 === 0,
  status: i === 4 || i === 17 ? 'maintenance' : 'active',
  minBet: [10, 20, 50, 100][i % 4],
  maxBet: [5000, 10000, 25000, 50000][i % 4],
  houseEdge: Number(((1 + (i % 5)) * 0.6).toFixed(2)),
  riskLevel: (['low', 'medium', 'high'] as const)[i % 3],
}));

export function gamesByCategory(slug: string) {
  if (slug === 'all') return mockGames;
  const map: Record<string, string> = {
    hot: 'c_hot',
    slots: 'c_slots',
    'live-casino': 'c_live',
    fishing: 'c_fish',
    sports: 'c_sports',
    lottery: 'c_lottery',
    poker: 'c_poker',
    esports: 'c_esports',
  };
  return mockGames.filter((g) => g.categoryId === map[slug]);
}
