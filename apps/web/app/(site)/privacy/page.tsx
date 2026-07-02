// Built by Anointed Coder.
//
// Public privacy policy, modeled on the terms page structure and
// reading measure. Bilingual (English + Bangla) via the site language
// toggle. The copy is intentionally generic and factual: it describes
// only what the platform actually collects and does, and promises
// nothing beyond that.
//
// OPERATOR NOTE: legal copy is the operator's responsibility. Please
// review every section below with your own counsel before launch and
// edit anything that does not match how you actually run the platform.

'use client';

import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { ShieldCheck } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';

interface Section { t: string; b: string }

function buildSections(bn: boolean): Section[] {
  if (bn) {
    return [
      { t: 'আমরা যে তথ্য সংগ্রহ করি', b: 'অ্যাকাউন্ট তথ্য (ইউজারনেম, ফোন নম্বর, ইমেইল যদি দেন), লেনদেনের রেকর্ড (ডিপোজিট, উইথড্রয়াল, বেট এবং বোনাস) এবং মৌলিক ডিভাইস তথ্য (আইপি ঠিকানা, ব্রাউজার ধরন, লগইন সময়)। আমরা শুধু প্ল্যাটফর্ম চালাতে যা প্রয়োজন তাই সংগ্রহ করি।' },
      { t: 'তথ্য ব্যবহারের উদ্দেশ্য', b: 'আপনার অ্যাকাউন্ট পরিচালনা, ডিপোজিট এবং উইথড্রয়াল যাচাই ও প্রসেস, প্রতারণা এবং একাধিক অ্যাকাউন্ট শনাক্তকরণ, সাপোর্ট রিকোয়েস্টের উত্তর এবং প্ল্যাটফর্মের নিরাপত্তা রক্ষা। আমরা আপনার তথ্য বিজ্ঞাপনদাতাদের কাছে বিক্রি করি না।' },
      { t: 'তথ্য সংরক্ষণ', b: 'অ্যাকাউন্ট সক্রিয় থাকা পর্যন্ত এবং আর্থিক রেকর্ডের ক্ষেত্রে যাচাই ও নিয়ন্ত্রক প্রয়োজনে যতদিন দরকার ততদিন তথ্য সংরক্ষিত থাকে। যে তথ্যের আর প্রয়োজন নেই তা মুছে ফেলা বা বেনামি করা হয়।' },
      { t: 'তথ্য শেয়ারিং', b: 'তথ্য শুধুমাত্র দুটি ক্ষেত্রে শেয়ার হয়: পেমেন্ট প্রসেসের জন্য পেমেন্ট প্রোভাইডারের সাথে (যেমন লেনদেন যাচাই), এবং আইনগত বাধ্যবাধকতা থাকলে কর্তৃপক্ষের সাথে। এর বাইরে কোনো তৃতীয় পক্ষকে আপনার ব্যক্তিগত তথ্য দেওয়া হয় না।' },
      { t: 'আপনার অধিকার', b: 'আপনি আপনার অ্যাকাউন্টে সংরক্ষিত তথ্য দেখতে, ভুল তথ্য সংশোধন করতে এবং অ্যাকাউন্ট বন্ধের অনুরোধ করতে পারেন। আর্থিক রেকর্ড আইনগত কারণে নির্দিষ্ট সময় পর্যন্ত রাখতে হতে পারে।' },
      { t: 'নিরাপত্তা', b: 'পাসওয়ার্ড হ্যাশ করে রাখা হয় এবং অ্যাডমিন অ্যাক্সেস সীমিত ও লগ করা হয়। কোনো সিস্টেমই শতভাগ নিরাপদ নয়, তাই শক্তিশালী পাসওয়ার্ড ব্যবহার করুন এবং তা কারো সাথে শেয়ার করবেন না।' },
      { t: 'যোগাযোগ', b: 'এই নীতি বা আপনার তথ্য নিয়ে যেকোনো প্রশ্নের জন্য সাপোর্ট পেজের মাধ্যমে টিকিট পাঠান। আমরা সাধারণত এক ঘণ্টার মধ্যে উত্তর দিই।' },
      { t: 'পরিবর্তন', b: 'এই নীতি সময়ে সময়ে হালনাগাদ হতে পারে। প্ল্যাটফর্ম ব্যবহার চালিয়ে গেলে হালনাগাদকৃত নীতি গ্রহণ করা হয়েছে বলে ধরা হবে।' },
    ];
  }
  return [
    { t: 'Information We Collect', b: 'Account details (username, phone number, and email if you provide one), transaction records (deposits, withdrawals, bets, and bonuses), and basic device information (IP address, browser type, login times). We collect only what the platform needs to operate.' },
    { t: 'Why We Use It', b: 'To run your account, verify and process deposits and withdrawals, detect fraud and multi-accounting, answer support requests, and keep the platform secure. We do not sell your information to advertisers.' },
    { t: 'How Long We Keep It', b: 'Account data is kept while your account is active. Financial records are kept as long as verification and regulatory duties require. Data that is no longer needed is deleted or anonymized.' },
    { t: 'Who We Share It With', b: 'Data is shared in exactly two cases: with payment providers to process and verify your transactions, and with authorities when the law requires it. Beyond that, your personal information is not handed to any third party.' },
    { t: 'Your Rights', b: 'You can view the information held on your account, ask us to correct anything inaccurate, and request account closure. Financial records may need to be retained for a period required by law.' },
    { t: 'Security', b: 'Passwords are stored hashed, and admin access is restricted and logged. No system is perfectly secure, so use a strong password and never share it with anyone.' },
    { t: 'Contact', b: 'For any question about this policy or your data, send a ticket through the Support page. We usually respond within an hour.' },
    { t: 'Changes', b: 'This policy may be updated from time to time. Continued use of the platform constitutes acceptance of the updated policy.' },
  ];
}

export default function PrivacyPage() {
  const { lang } = useLang();
  const bn = lang === 'bn';
  const sections = buildSections(bn);

  return (
    <>
      <PageHeader
        title={bn ? 'প্রাইভেসি নীতি' : 'Privacy Policy'}
        subtitle={bn ? 'আপনার তথ্য নিয়ে আমরা কী করি এবং কী করি না, সহজ ভাষায়' : 'Plain language summary of what we do and do not do with your data'}
        icon={<ShieldCheck className="h-5 w-5" />}
      />
      <Card padding="lg" className="space-y-5">
        {sections.map((s, i) => (
          <article key={s.t}>
            <h2 className="text-base font-semibold text-ink-hi">{i + 1}. {s.t}</h2>
            <p className="mt-1 max-w-[70ch] text-base leading-relaxed text-ink-mid">{s.b}</p>
          </article>
        ))}
      </Card>
    </>
  );
}
