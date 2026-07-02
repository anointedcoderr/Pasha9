# Pasha9 Bonus and Campaign Setup, Operator Handover

Built by Anointed Coder.

This document explains everything the demo setup script configures, what
triggers each bonus, and exactly how to test deposits against it.

## Prerequisites (before the first run on the VPS)

The banner images carry Bangla headlines rendered with the Noto Sans
Bengali font. If the VPS has no Bengali font installed the headlines come
out as empty boxes. Install the font once before the first run:

```
sudo apt-get install -y fonts-noto-bengali && fc-cache -f
```

The script prints this same hint at startup and keeps going either way,
so if you forgot, install the font and simply run the script again to
regenerate the images.

Run the script on the VPS from the repo root:

```
cd /var/www/pasha9/apps/web
UPLOAD_ROOT=/var/www/pasha9/uploads pnpm --filter @pasha9/web exec tsx scripts/demo-setup.ts
```

It is safe to run more than once. It never touches player balances,
deposits, withdrawals or any money table. It only writes bonus rules,
campaign rows, banner rows and banner images.

## One rule the whole platform follows

Each approved deposit grants exactly ONE deposit bonus. The platform picks
it like this:

1. If the player started from a promotion card (Promotions page, Claim
   button), that promotion is attached to the deposit and that is the
   bonus that pays.
2. Otherwise the best matching reload tier is attached automatically at
   submit time (the highest tier whose minimum is at or below the amount).
3. Only when neither applies (for example a deposit under 500 BDT) does
   the engine fall through and evaluate the remaining rules, which is
   where the Daily Bonus fires.

Keep this in mind while testing: a plain first deposit gets the reload
tier, not the Welcome Bonus. To grant the Welcome Bonus the player must
claim it from the Promotions page first. Known display quirk: for a brand
new player the deposit form preview can quote the bigger welcome figure
even on a plain deposit, while the actual grant follows the attached
reload tier. Always start the welcome deposit from the promotion card so
the preview and the grant agree.

## 1. Welcome Bonus (code: welcome)

- Trigger: the player opens Promotions, presses Claim on the Welcome
  Bonus card, and completes the deposit form it opens.
- Condition: first approved deposit of the account only, minimum 500 BDT.
- Payout: 100 percent of the deposit, capped at 5,000 BDT.
- Turnover lock: 10x the bonus amount must be wagered before withdrawal.
- Expiry: the grant expires 30 days after it is issued.
- Change it at: Admin, Bonuses, edit the rule named Welcome Bonus.

## 2. Reload tier ladder (every deposit)

- Trigger: automatic on every approved deposit, no claim needed.
- Tiers: 500+ BDT pays 5 percent, 2,000+ BDT pays 8 percent, 10,000+ BDT
  pays 12 percent. The highest matching tier wins.
- Tiers are percentage only. There is no per-tier bonus cap; a 100,000
  BDT deposit on the 12 percent tier pays 12,000 BDT.
- Turnover lock: 10x the bonus.
- Claim limit: the tier configuration is unlimited, but the claim ledger
  deduplicates per rule per UTC day. In practice each tier pays a given
  player at most once per day: a second deposit landing in the same tier
  on the same day is approved normally but without a bonus. Deposits that
  land in a different tier the same day still pay.
- Change it at: Admin, Deposit Bonus Tiers.
- Reconciliation: the script deactivates any other active tier that is
  not part of the 500 / 2,000 / 10,000 ladder, because a stray tier
  would compete with the ladder (the engine picks the highest matching
  minimum). Nothing is deleted; each deactivated tier is listed in the
  script output and can be re-enabled at Admin, Deposit Bonus Tiers.
- Respecting your edits: if you deactivated one of the three ladder
  tiers yourself, the script logs it and leaves it deactivated instead
  of switching it back on.

## 3. Daily Bonus (code: daily_bonus)

- Trigger: automatic, first qualifying deposit of each day.
- Condition: deposit between 200 and 499 BDT. From 500 BDT upward the
  reload tier ladder takes over instead, because the platform grants only
  one deposit bonus per deposit and the ladder has higher priority.
- Payout: 5 percent, capped at 500 BDT. Turnover lock: 10x the bonus.
- Claim limit: once per rolling day per player.
- Change it at: Admin, Bonuses, edit the rule named Daily Bonus.

## 4. Daily Cashback (campaign: Daily Cashback)

- Trigger: automatic, paid by the nightly cron at 00:05 UTC (06:05 in
  Dhaka). Each run covers the previous UTC day, midnight to midnight.
- Condition: the player finished that day with a net loss (bets minus
  wins across all games). There is no minimum loss threshold, any net
  loss qualifies.
- Payout: 10 percent of the net loss, capped at 500 BDT per day, credited
  straight to the main balance with a 10x turnover lock.
- Preview button: Admin, Cashback has a Preview action per campaign. It
  runs the exact same calculation for today so far and shows who would be
  paid and how much, without paying anything. Use it to sanity check
  before the nightly run.
- A player can only be paid once per campaign per day; re-running is safe.
- Change it at: Admin, Cashback. The script never edits any other
  campaign you may have created there.

## 5. Promotions page

Two promotion cards carry generated banner images:

- Welcome Bonus (welcome offer, claim opens the deposit form with the
  promotion attached, promo code welcome).
- Daily Bonus (reload offer, claim opens the deposit form with the
  promotion attached, promo code daily_bonus).

The promo code travels with the deposit and is stored on the deposit row,
so you can see in Admin, Deposits which promotion a deposit claimed. The
turnover lock shown on each card comes from the rule itself (10x for
both). Edit card text, images and terms at Admin, Bonuses; the Promotions
hero banner deck is at Admin, Promotions.

## 6. Betting Pass

- Earning: 1 point per 1 BDT of approved deposit and 1 point per 1 BDT
  wagered on provider bets (configurable at Admin, Betting Pass).
- Tiers: Bronze at 1,000 points pays a 200 BDT bonus, Silver at 5,000
  pays 500, Gold at 15,000 pays 1,500, Diamond at 50,000 pays 5,000. All
  bonus rewards carry a 10x turnover lock.
- Trigger: the player claims each unlocked tier on the Betting Pass page,
  one claim per tier per player.
- The script only creates tiers that do not exist yet, so your own tuning
  survives re-runs.

## 7. Referral and affiliate commissions

- Tiers already seeded: bronze pays 8 / 4 / 2 percent across three
  downline levels, silver 10 / 5 / 2, gold 12 / 6 / 3. The script only
  verifies they exist and recreates them if missing.
- Trigger: commissions accrue automatically when a referred player's
  deposit is approved, then mature into the claimable referral balance
  after the hold window (default 7 days).
- Change it at: Admin, Affiliate and Admin, Settings (referral keys).

## 8. Lotto

- Players earn 2 tickets per accumulated 1,200 BDT of approved deposits
  (Admin, Settings, lotto keys).
- The script guarantees at least one open draw with a future draw time
  (Daily 4D, stamped for tomorrow 21:00 Dhaka time if no open future draw
  existed). Manage draws and publish results at Admin, Lotto.

## 9. Banners

The script generates premium placeholder images (dark base, gold accents,
Bangla headline with English subline, Pasha9 wordmark) and writes them to
the uploads folder under banners with fixed filenames, so re-running the
script refreshes the same files instead of piling up copies:

- Two homepage hero banners (positions 1 and 2): welcome offer and daily
  cashback. Manage at Admin, Banners.
- Promotion card images for the Welcome Bonus and Daily Bonus rules.
- One Promotions page hero banner (Admin, Promotions).
- One Betting Pass hero banner (Admin, Betting Pass).

Your own banners are safe. The script only ever updates hero banner rows
it created itself (it recognises them by the pasha9- file marker in the
image path) and it never touches a video banner. If positions 1 or 2
already hold your own content, the script leaves them alone and creates
the demo banners at the next free positions instead, and says so in its
output.

Caching note: files under /uploads are cached long-term by the server,
so replacing artwork under the same filename can keep showing the old
image to visitors for a long time. Replacing artwork needs a new
filename, which the admin upload does automatically, so always swap
images through the admin upload rather than overwriting files on disk.

The cashback campaign has no image slot in the platform, so its story is
told through the homepage hero banner instead.

Adding a video banner: the script does not create one because there is no
video asset yet. To add one yourself go to Admin, Banners, create a new
banner, set Media Type to Video, upload an mp4 or webm file, and add a
poster image so mobile browsers have a still image while the video loads.

## Deposit test recipe

Use a fresh player account and have an admin approve each deposit at
Admin, Deposits. Expected results:

1. Welcome test: on the new account open Promotions, press Claim on
   Welcome Bonus, deposit 1,000 BDT. After approval the balance shows
   1,000 deposit plus 1,000 bonus, and withdrawal is locked until 10,000
   BDT (10x the bonus) has been wagered.
2. Reload tier test: plain deposit of 2,000 BDT from the Deposit page.
   Expect 160 BDT bonus (8 percent), turnover lock 1,600 BDT.
3. Big tier test: plain deposit of 30,000 BDT. Expect 3,600 BDT bonus
   (12 percent, no cap), turnover lock 36,000 BDT.
4. Same tier repeat test: a second plain 2,000 BDT deposit on the same
   day as test 2 approves with no bonus (each tier pays once per day per
   player). The next day it pays 160 BDT again.
5. Daily Bonus test: next day, first deposit of the day, plain deposit of
   300 BDT. Expect 15 BDT bonus (5 percent), turnover lock 150 BDT. A
   second 300 BDT deposit the same day pays nothing (once per day).
6. Cashback test: bet and lose a net 1,000 BDT during one UTC day. Use
   the Preview button at Admin, Cashback to confirm the pending figure
   (100 BDT). After 00:05 UTC the cron pays it automatically with a
   1,000 BDT turnover lock. If the cron is not scheduled yet, add the
   crontab line from docs/M4-DELIVERY.md.
7. Lotto test: after 1,200 BDT of cumulative approved deposits the player
   receives 2 tickets for the open Daily 4D draw.
8. Betting Pass test: after the deposits above the player has points
   (1 per BDT). Claim Bronze at 1,000 points for a 200 BDT bonus with a
   2,000 BDT turnover lock.

Every bonus shows up on the player dashboard with its own turnover
progress bar, and in Admin, Bonuses, Grants where you can trace it back
to the deposit that triggered it.

## APK download button

The APK download button stays hidden and unset for now; the APK will be
built after the site is confirmed working (client decision).
