// Built by Anointed Coder.
'use client';

import { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { BackBar } from '@/components/site/BackBar';
import { CategoryHero } from '@/components/site/CategoryHero';
import { useLang } from '@/lib/i18n/context';
import { cn } from '@/lib/utils/cn';

interface FaqItem {
  qEn: string;
  qBn: string;
  aEn: string;
  aBn: string;
}

const ITEMS: FaqItem[] = [
  {
    qEn: 'How do I register on Pasha 9?',
    qBn: 'পাশা ৯ এ কীভাবে রেজিস্টার করব?',
    aEn: 'Tap Register on the header, enter your mobile number, a username and a password. You will be logged in straight away.',
    aBn: 'হেডারের রেজিস্টার বাটনে চাপ দিন, মোবাইল নম্বর, ইউজারনেম ও পাসওয়ার্ড দিন। সাথে সাথে লগইন হয়ে যাবেন।',
  },
  {
    qEn: 'How do I deposit money?',
    qBn: 'কীভাবে টাকা ডিপোজিট করব?',
    aEn: 'Go to Deposit, choose a payment method, send the payment to the displayed account, then submit the transaction ID and proof. Balance is credited after admin verification.',
    aBn: 'ডিপোজিট পেজে যান, একটি পেমেন্ট মেথড বেছে নিন, প্রদর্শিত অ্যাকাউন্টে পাঠান, এরপর ট্রান্সজেকশন আইডি এবং প্রমাণ জমা দিন। অ্যাডমিন যাচাইয়ের পর ব্যালেন্স যোগ হবে।',
  },
  {
    qEn: 'How long does withdrawal take?',
    qBn: 'উইথড্রয়াল কত সময় লাগে?',
    aEn: 'Withdrawal requests are reviewed by admin and processed within a few hours during business time. Turnover requirements may apply if bonuses are involved.',
    aBn: 'উইথড্রয়াল রিকোয়েস্ট অ্যাডমিন যাচাই করে কয়েক ঘণ্টার মধ্যে প্রক্রিয়াজাত করা হয়। বোনাস থাকলে টার্নওভার শর্ত প্রযোজ্য হতে পারে।',
  },
  {
    qEn: 'How does the referral program work?',
    qBn: 'রেফারেল প্রোগ্রাম কীভাবে কাজ করে?',
    aEn: 'Share your referral link or code. You earn commission across three levels of downline activity. See the Referral or Affiliate page for the current rates.',
    aBn: 'আপনার রেফারেল লিঙ্ক বা কোড শেয়ার করুন। তিনটি স্তরের ডাউনলাইন কার্যকলাপের উপর কমিশন পাবেন। বর্তমান হার রেফারেল বা অ্যাফিলিয়েট পেজে দেখুন।',
  },
  {
    qEn: 'Is my account safe?',
    qBn: 'আমার অ্যাকাউন্ট কি নিরাপদ?',
    aEn: 'Pasha 9 uses bcrypt password hashing, signed session cookies and server-side session revocation. Always keep your password private and change it after first login.',
    aBn: 'পাশা ৯ bcrypt পাসওয়ার্ড হ্যাশিং, সাইনড সেশন কুকি এবং সার্ভার-সাইড সেশন রিভোকেশন ব্যবহার করে। পাসওয়ার্ড সবসময় গোপন রাখুন এবং প্রথম লগইনের পর পরিবর্তন করুন।',
  },
  {
    qEn: 'Who do I contact for support?',
    qBn: 'সাপোর্টের জন্য কাকে যোগাযোগ করব?',
    aEn: 'Tap the floating chat button in the lower-right corner. WhatsApp, Telegram and email options are available depending on what the operator has enabled.',
    aBn: 'নিচের ডান কোণায় ফ্লোটিং চ্যাট বাটনে চাপ দিন। অপারেটর যেগুলো চালু রেখেছেন সেগুলো থেকে WhatsApp, Telegram এবং ইমেইল অপশন পাবেন।',
  },
];

export default function FaqPage() {
  const { lang } = useLang();
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="space-y-4">
      <BackBar title={lang === 'bn' ? 'প্রশ্ন ও উত্তর' : 'FAQ'} />

      <CategoryHero
        kicker={lang === 'bn' ? 'সাপোর্ট সেন্টার' : 'Support Center'}
        title={lang === 'bn' ? 'প্রায়শই জিজ্ঞাসিত প্রশ্ন' : 'Frequently asked questions'}
        description={
          lang === 'bn'
            ? 'পাশা ৯ ব্যবহারে যা জানা দরকার'
            : 'Everything you need to know to play on Pasha 9.'
        }
        accent="yellow"
      />

      <section className="space-y-2">
        {ITEMS.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={i} className="card-light overflow-hidden">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition hover:bg-brand-surface"
              >
                <span className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-yellow-500/15 text-brand-yellow-600">
                    <HelpCircle className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-bold text-brand-ink md:text-base">
                    {lang === 'bn' ? item.qBn : item.qEn}
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 shrink-0 text-brand-inkMute transition-transform',
                    isOpen && 'rotate-180 text-brand-ink',
                  )}
                />
              </button>
              {isOpen ? (
                <div className="border-t border-brand-divider bg-brand-surface px-4 py-3.5 text-sm leading-relaxed text-brand-inkSoft">
                  {lang === 'bn' ? item.aBn : item.aEn}
                </div>
              ) : null}
            </div>
          );
        })}
      </section>
    </div>
  );
}
