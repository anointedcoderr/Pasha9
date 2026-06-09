// Built by Anointed Coder.
//
// Catalog of sound slots used by the premium Spin and Lotto pages.
// One source of truth - the admin page, the public read endpoint
// and the useSound() hook all import from here so a new slot only
// needs to be added in one place.

export interface SoundSlot {
  /** SystemSetting key. */
  key: string;
  /** Identifier used by the client hook. */
  id: string;
  /** Admin-facing English label. */
  labelEn: string;
  /** Admin-facing Bangla label. */
  labelBn: string;
  /** When the sound plays. Shown as a hint on the admin card. */
  descriptionEn: string;
  descriptionBn: string;
  /** Group for the admin page. */
  group: 'spin' | 'lotto' | 'ui';
  /** Hint about whether the sound should loop. Reference for the admin only. */
  loop?: boolean;
}

export const SOUND_SLOTS: SoundSlot[] = [
  // Spin slots
  {
    key: 'sound_spin_windup', id: 'spin_windup',
    labelEn: 'Spin: wind-up', labelBn: 'স্পিন: ওয়াইন্ড-আপ',
    descriptionEn: 'Plays when the player presses SPIN.',
    descriptionBn: 'স্পিন বোতাম চাপলে বাজে।',
    group: 'spin',
  },
  {
    key: 'sound_spin_tick', id: 'spin_tick',
    labelEn: 'Spin: tick (loop)', labelBn: 'স্পিন: টিক (লুপ)',
    descriptionEn: 'Loops while the wheel is spinning. Short rhythmic tick.',
    descriptionBn: 'হুইল ঘুরাকালীন লুপে বাজে। ছোট তালবদ্ধ টিক।',
    group: 'spin',
    loop: true,
  },
  {
    key: 'sound_spin_land', id: 'spin_land',
    labelEn: 'Spin: landing', labelBn: 'স্পিন: ল্যান্ডিং',
    descriptionEn: 'Plays when the wheel stops on a segment.',
    descriptionBn: 'হুইল কোনো সেগমেন্টে থামলে বাজে।',
    group: 'spin',
  },
  {
    key: 'sound_spin_win', id: 'spin_win',
    labelEn: 'Spin: win', labelBn: 'স্পিন: জয়',
    descriptionEn: 'Plays when the spin awarded a prize.',
    descriptionBn: 'স্পিন থেকে পুরস্কার পেলে বাজে।',
    group: 'spin',
  },
  {
    key: 'sound_spin_jackpot', id: 'spin_jackpot',
    labelEn: 'Spin: jackpot', labelBn: 'স্পিন: জ্যাকপট',
    descriptionEn: 'Plays when the top-tier wedge wins. Falls back to the win sound when empty.',
    descriptionBn: 'সর্বোচ্চ স্তরের সেগমেন্টে জিতলে বাজে। খালি থাকলে জয়ের সাউন্ড বাজবে।',
    group: 'spin',
  },
  {
    key: 'sound_spin_loss', id: 'spin_loss',
    labelEn: 'Spin: no prize', labelBn: 'স্পিন: পুরস্কার নেই',
    descriptionEn: 'Plays when the spin result was no prize.',
    descriptionBn: 'স্পিন ফলাফল পুরস্কারহীন হলে বাজে।',
    group: 'spin',
  },
  // Lotto slots
  {
    key: 'sound_lotto_tumbler', id: 'lotto_tumbler',
    labelEn: 'Lotto: tumbler rumble', labelBn: 'লটো: টামব্লার রাম্বল',
    descriptionEn: 'Plays when the result ball animation begins.',
    descriptionBn: 'বল অ্যানিমেশন শুরু হলে বাজে।',
    group: 'lotto',
  },
  {
    key: 'sound_lotto_ball_pop', id: 'lotto_ball_pop',
    labelEn: 'Lotto: ball pop', labelBn: 'লটো: বল পপ',
    descriptionEn: 'Plays each time a ball lands in the winning frame.',
    descriptionBn: 'বিজয়ী ফ্রেমে প্রতিটি বল আসার সময় বাজে।',
    group: 'lotto',
  },
  {
    key: 'sound_lotto_reveal', id: 'lotto_reveal',
    labelEn: 'Lotto: winning number reveal', labelBn: 'লটো: বিজয়ী নম্বর প্রকাশ',
    descriptionEn: 'Plays once the final winning number is locked in.',
    descriptionBn: 'চূড়ান্ত বিজয়ী নম্বর লক হলে বাজে।',
    group: 'lotto',
  },
  {
    key: 'sound_lotto_ticket_print', id: 'lotto_ticket_print',
    labelEn: 'Lotto: ticket print', labelBn: 'লটো: টিকেট প্রিন্ট',
    descriptionEn: 'Plays on the my-tickets page when tickets first render.',
    descriptionBn: 'আমার টিকেট পেজে টিকেট প্রথম রেন্ডার হলে বাজে।',
    group: 'lotto',
  },
  {
    key: 'sound_lotto_stamp', id: 'lotto_stamp',
    labelEn: 'Lotto: WINNER stamp', labelBn: 'লটো: WINNER সিল',
    descriptionEn: 'Plays when the WINNER stamp animation lands on a won ticket.',
    descriptionBn: 'জয়ী টিকেটে WINNER সিল আসার সময় বাজে।',
    group: 'lotto',
  },
  // UI
  {
    key: 'sound_ui_click', id: 'ui_click',
    labelEn: 'UI: button click', labelBn: 'UI: বোতাম ক্লিক',
    descriptionEn: 'Plays on premium CTA presses across both pages.',
    descriptionBn: 'উভয় পেজের প্রিমিয়াম CTA চাপলে বাজে।',
    group: 'ui',
  },
];

export const MASTER_ENABLED_KEY = 'sounds_enabled';
export const DEFAULT_VOLUME_KEY = 'sounds_default_volume';
