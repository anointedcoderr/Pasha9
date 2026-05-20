import type { Banner, PopupAnnouncement, PromoText } from '@/types';

export const mockBanners: Banner[] = [
  {
    id: 'b_01',
    title: 'প্রথম ডিপোজিটে ১০০% বোনাস',
    subtitle: 'মাত্র ৫০০ টাকা থেকে শুরু করুন এবং বোনাস দাবি করুন',
    ctaLabel: 'এখন রেজিস্টার',
    ctaHref: '/promotions',
    accent: 'gold',
    position: 1,
    status: 'active',
  },
  {
    id: 'b_02',
    title: 'প্রিমিয়াম লাইভ ক্যাসিনো',
    subtitle: 'প্রকৃত ডিলার, স্বচ্ছ গেম, নিরাপদ পেমেন্ট',
    ctaLabel: 'লাইভ ক্যাসিনো খুলুন',
    ctaHref: '/live-casino',
    accent: 'neon',
    position: 2,
    status: 'active',
  },
  {
    id: 'b_03',
    title: 'রেফারেল কমিশন প্রতিদিন',
    subtitle: 'তিন স্তরের রেফারেল কাঠামো সাথে দ্রুত পেআউট',
    ctaLabel: 'রেফারেল চালু করুন',
    ctaHref: '/referral',
    accent: 'mixed',
    position: 3,
    status: 'active',
  },
];

export const mockPopups: PopupAnnouncement[] = [
  {
    id: 'p_01',
    title: 'সাপ্তাহিক রিওয়ার্ড লাইভ',
    body: 'প্রতি শুক্রবার রাত ১০টায় সাপ্তাহিক টপ ব্যবহারকারীদের পুরস্কার বিতরণ। বিস্তারিত প্রমোশন পেজে দেখুন।',
    ctaLabel: 'প্রমোশন দেখুন',
    ctaHref: '/promotions',
    startAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    endAt: new Date(Date.now() + 86400000 * 5).toISOString(),
    status: 'active',
  },
  {
    id: 'p_02',
    title: 'নির্ধারিত মেইন্টেনেন্স',
    body: 'রাত ৩টা থেকে ৪টা পর্যন্ত সংক্ষিপ্ত মেইন্টেনেন্স চলবে। অসুবিধার জন্য দুঃখিত।',
    startAt: new Date(Date.now() - 86400000).toISOString(),
    endAt: new Date(Date.now() + 86400000).toISOString(),
    status: 'hidden',
  },
];

export const mockPromoTexts: PromoText[] = [
  { id: 'pt_01', message: '🎁 প্রথম ডিপোজিটে ১০০% বোনাস। আজই দাবি করুন।', status: 'active', position: 1 },
  { id: 'pt_02', message: '🏆 রেফারেল করে প্রতিদিন বাড়তি ইনকাম।', status: 'active', position: 2 },
  { id: 'pt_03', message: '🎰 প্রিমিয়াম লাইভ ক্যাসিনো এখন আপনার হাতের মুঠোয়।', status: 'active', position: 3 },
  { id: 'pt_04', message: '🛡️ সব লেনদেন এনক্রিপ্টেড এবং নিরাপদ।', status: 'active', position: 4 },
];
