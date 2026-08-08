// Built by Anointed Coder.
//
// UNIFIED ADMIN SECTION REGISTRY - the single source of truth for the admin
// permission system.
//
// M2G Phase 5: true one-to-one. Every literal AdminSidebar row gets its own
// entry here, gated by its own dedicated menu.<key>.view permission code -
// no grouping, no shared toggles. Checking "Homepage" in the Staff picker
// shows ONLY the Homepage row; every other row (including ones that used to
// share a code with it, like Popups or Ambassador) stays exactly as it was.
//
// Two permission layers, kept deliberately separate:
//   - VIEW  (menu.<key>.view, minted fresh for this phase): controls ONLY
//     whether the row shows in the sidebar and whether its page can be
//     opened at all - the sidebar filter and the client/server URL guards
//     all read this.
//   - business actions (deposits.review, homepage.write, ...): the existing
//     codes, UNCHANGED, still gate the actual save/edit/approve API calls
//     on that page. Granting "Homepage: view" alone does NOT let someone
//     save homepage content - they (or their role) still need homepage.write
//     too. This is intentional: flipping every save/edit action to its own
//     brand-new per-page code as well would mean rewriting every affected
//     API route's authorization, which is real, further work - not done in
//     this pass, and not silently pretended to be.
//
// This ONE file drives all of:
//   1. The Super Admin permission screen (friendly names + per-row toggles)
//   2. The admin sidebar (a staff member only sees rows they can view)
//   3. The URL guard (direct access to an unpermitted page is blocked)
//
// Config over hardcoding: adding a future admin page is one new entry here
// (plus its matching AdminSidebar item and a menu.<key>.view permission row
// in prisma/seed.ts), and the sidebar, picker and guard all update together.

export type SectionActionKind = 'view' | 'create' | 'edit' | 'approve' | 'delete' | 'manage' | 'tiers' | 'adjust';

export interface SectionAction {
  /** Stable control kind, drives ordering + the toggle rendered. */
  kind: SectionActionKind;
  /** Friendly control label shown to the Super Admin. */
  label: string;
  /** The RBAC permission code this control grants (must exist in the catalog). */
  permission: string;
}

export interface AdminSection {
  /** Stable section key - matches the AdminSidebar menu key it owns. */
  key: string;
  /** Human name shown to the Super Admin (matches the sidebar label). */
  label: string;
  /** Picker group heading, for scannability only - every row underneath is
   *  still its own independent permission, this is not a shared toggle. */
  group: string;
  /** /admin route prefixes this row owns (longest-prefix match). */
  routes: string[];
  /** Granular controls. First entry is always the view/visibility gate. */
  actions: SectionAction[];
  /** Only the Super Admin can be granted this row (Staff management). */
  superAdminOnly?: boolean;
  /** Open to any signed-in admin/staff, no permission required. */
  alwaysAllow?: boolean;
}

const view = (permission: string): SectionAction => ({ kind: 'view', label: 'View', permission });
const approve = (permission: string): SectionAction => ({ kind: 'approve', label: 'Approve / reject', permission });
const edit = (permission: string, label = 'Edit'): SectionAction => ({ kind: 'edit', label, permission });
const manage = (permission: string, label = 'Manage'): SectionAction => ({ kind: 'manage', label, permission });
const adjust = (permission: string, label: string): SectionAction => ({ kind: 'adjust', label, permission });
const tiers = (permission: string, label: string): SectionAction => ({ kind: 'tiers', label, permission });

// Order mirrors the admin sidebar top to bottom.
export const ADMIN_SECTIONS: AdminSection[] = [
  { key: 'overview', label: 'Dashboard', group: 'Overview', routes: ['/admin'], actions: [view('menu.overview.view')] },

  // ---- Operations ----
  { key: 'deposits', label: 'Deposits', group: 'Operations', routes: ['/admin/deposits'], actions: [view('menu.deposits.view'), approve('deposits.review')] },
  { key: 'withdrawals', label: 'Withdrawals', group: 'Operations', routes: ['/admin/withdrawals'], actions: [view('menu.withdrawals.view'), approve('withdrawals.review')] },
  { key: 'transactions', label: 'Transaction Log', group: 'Operations', routes: ['/admin/transactions'], actions: [view('menu.transactions.view')] },
  { key: 'payments', label: 'Payments', group: 'Operations', routes: ['/admin/payments'], actions: [view('menu.payments.view'), manage('settings.write', 'Configure gateway')] },
  { key: 'payouts', label: 'Payouts', group: 'Operations', routes: ['/admin/payouts'], actions: [view('menu.payouts.view')] },
  { key: 'paymentMethods', label: 'Payment Methods', group: 'Operations', routes: ['/admin/payment-methods'], actions: [view('menu.paymentMethods.view')] },
  { key: 'withdrawalLimits', label: 'Withdrawal Limits', group: 'Operations', routes: ['/admin/withdrawal-limits'], actions: [view('menu.withdrawalLimits.view')] },
  { key: 'paymentsReconciliation', label: 'Payments Reconciliation', group: 'Operations', routes: ['/admin/payments/reconciliation', '/admin/payments-reconciliation'], actions: [view('menu.paymentsReconciliation.view')] },
  { key: 'operations', label: 'Operations Monitor', group: 'Operations', routes: ['/admin/operations'], actions: [view('menu.operations.view')] },
  { key: 'depositNotice', label: 'Deposit Notice', group: 'Operations', routes: ['/admin/deposit-notice'], actions: [view('menu.depositNotice.view'), edit('settings.write')] },

  // ---- Users & money ----
  { key: 'users', label: 'User Management', group: 'Users & Money', routes: ['/admin/users'], actions: [view('menu.users.view'), edit('users.update'), manage('users.write', 'Full access')] },
  { key: 'balance', label: 'Balance Management', group: 'Users & Money', routes: ['/admin/balance'], actions: [view('menu.balance.view'), adjust('users.balance.adjust', 'Adjust balance')] },
  { key: 'referrals', label: 'Referrals', group: 'Users & Money', routes: ['/admin/referrals'], actions: [view('menu.referrals.view'), manage('referrals.write', 'Approve & adjust')] },
  { key: 'referralClaims', label: 'Referral Claims', group: 'Users & Money', routes: ['/admin/referral-claims'], actions: [view('menu.referralClaims.view')] },
  { key: 'recovery', label: 'Player Recovery', group: 'Users & Money', routes: ['/admin/recovery'], actions: [view('menu.recovery.view'), manage('recovery.write', 'Run recovery')] },

  // ---- Bonus & affiliate ----
  { key: 'bonuses', label: 'Bonus Management', group: 'Bonus & Affiliate', routes: ['/admin/bonuses'], actions: [view('menu.bonuses.view'), manage('bonuses.write', 'Full access')] },
  { key: 'depositBonusTiers', label: 'Deposit Bonus Tiers', group: 'Bonus & Affiliate', routes: ['/admin/deposit-bonus-tiers'], actions: [view('menu.depositBonusTiers.view'), edit('bonuses.write')] },
  { key: 'promotionBanners', label: 'Promotion Banners', group: 'Bonus & Affiliate', routes: ['/admin/promotions'], actions: [view('menu.promotionBanners.view'), edit('bonuses.write')] },
  { key: 'affiliate', label: 'Affiliate', group: 'Bonus & Affiliate', routes: ['/admin/affiliate'], actions: [view('menu.affiliate.view'), manage('affiliate.write', 'Approve & manage')] },
  { key: 'affiliateTiers', label: 'Affiliate Tiers', group: 'Bonus & Affiliate', routes: ['/admin/affiliate-tiers'], actions: [view('menu.affiliateTiers.view'), tiers('affiliate.tiers.write', 'Commission tiers')] },
  { key: 'vip', label: 'VIP Club', group: 'Bonus & Affiliate', routes: ['/admin/vip'], actions: [view('menu.vip.view'), edit('settings.write')] },

  // ---- Content & media (previously one bundled "Website Customization" toggle) ----
  { key: 'website', label: 'Website', group: 'Content & Media', routes: ['/admin/website'], actions: [view('menu.website.view'), edit('settings.write')] },
  { key: 'banners', label: 'Banners', group: 'Content & Media', routes: ['/admin/banners'], actions: [view('menu.banners.view'), edit('banners.write')] },
  { key: 'popups', label: 'Popups', group: 'Content & Media', routes: ['/admin/popups'], actions: [view('menu.popups.view'), edit('popups.write')] },
  { key: 'welcomePopup', label: 'Welcome Popup', group: 'Content & Media', routes: ['/admin/welcome-popup'], actions: [view('menu.welcomePopup.view'), edit('popups.write')] },
  { key: 'promoText', label: 'Promo Text', group: 'Content & Media', routes: ['/admin/promo-text'], actions: [view('menu.promoText.view'), edit('promo.write')] },
  { key: 'homepage', label: 'Homepage', group: 'Content & Media', routes: ['/admin/homepage'], actions: [view('menu.homepage.view'), edit('homepage.write')] },
  { key: 'homepageSections', label: 'Homepage Sections', group: 'Content & Media', routes: ['/admin/homepage-sections'], actions: [view('menu.homepageSections.view'), edit('homepage.write')] },
  { key: 'homepageBlocks', label: 'Homepage Blocks', group: 'Content & Media', routes: ['/admin/homepage-blocks'], actions: [view('menu.homepageBlocks.view'), edit('homepage.write')] },
  { key: 'homepagePromoPair', label: 'Homepage Promo Pair', group: 'Content & Media', routes: ['/admin/homepage-promo-pair'], actions: [view('menu.homepagePromoPair.view'), edit('settings.write')] },
  { key: 'homepageShortcuts', label: 'Homepage Shortcuts', group: 'Content & Media', routes: ['/admin/homepage-shortcuts'], actions: [view('menu.homepageShortcuts.view'), edit('homepage.write')] },
  { key: 'sportsEvents', label: 'Sports Events', group: 'Content & Media', routes: ['/admin/sports-events'], actions: [view('menu.sportsEvents.view'), edit('homepage.write')] },
  { key: 'ambassador', label: 'Ambassador', group: 'Content & Media', routes: ['/admin/ambassador'], actions: [view('menu.ambassador.view'), edit('ambassador.write')] },
  { key: 'brandAmbassadors', label: 'Brand Ambassadors', group: 'Content & Media', routes: ['/admin/brand-ambassadors'], actions: [view('menu.brandAmbassadors.view'), edit('settings.write')] },
  { key: 'sponsors', label: 'Sponsors', group: 'Content & Media', routes: ['/admin/sponsors'], actions: [view('menu.sponsors.view'), edit('settings.write')] },
  { key: 'publicPaymentMethods', label: 'Public Payment Methods', group: 'Content & Media', routes: ['/admin/public-payment-methods'], actions: [view('menu.publicPaymentMethods.view'), edit('settings.write')] },
  { key: 'socialLinks', label: 'Social Links', group: 'Content & Media', routes: ['/admin/social-links'], actions: [view('menu.socialLinks.view'), edit('settings.write')] },

  // ---- Lotto & rewards ----
  { key: 'lotto', label: 'Lottery', group: 'Lotto & Rewards', routes: ['/admin/lotto'], actions: [view('menu.lotto.view'), manage('lotto.write', 'Manage draws')] },
  { key: 'lottoBanners', label: 'Lottery Banners', group: 'Lotto & Rewards', routes: ['/admin/lotto-banners'], actions: [view('menu.lottoBanners.view'), edit('homepage.write')] },
  { key: 'rewards', label: 'Rewards', group: 'Lotto & Rewards', routes: ['/admin/rewards'], actions: [view('menu.rewards.view'), manage('rewards.write', 'Manage catalog')] },
  { key: 'rewardClaims', label: 'Reward Claims', group: 'Lotto & Rewards', routes: ['/admin/reward-claims'], actions: [view('menu.rewardClaims.view'), edit('rewards.write')] },
  { key: 'bettingPass', label: 'Betting Pass', group: 'Lotto & Rewards', routes: ['/admin/betting-pass'], actions: [view('menu.bettingPass.view'), edit('rewards.write')] },
  { key: 'bettingPassBanners', label: 'Betting Pass Banners', group: 'Lotto & Rewards', routes: ['/admin/betting-pass/banners'], actions: [view('menu.bettingPassBanners.view'), edit('rewards.write')] },
  { key: 'spinTiers', label: 'Spin Tiers', group: 'Lotto & Rewards', routes: ['/admin/spin-tiers'], actions: [view('menu.spinTiers.view'), edit('rewards.write')] },
  { key: 'spinSegments', label: 'Spin Segments', group: 'Lotto & Rewards', routes: ['/admin/spin-segments'], actions: [view('menu.spinSegments.view'), edit('rewards.write')] },
  { key: 'nativeGames', label: 'Native Games', group: 'Lotto & Rewards', routes: ['/admin/native-games'], actions: [view('menu.nativeGames.view'), edit('settings.write')] },
  { key: 'wingo', label: 'WinGo', group: 'Lotto & Rewards', routes: ['/admin/wingo'], actions: [view('menu.wingo.view'), edit('settings.write')] },
  { key: 'tournaments', label: 'Tournaments', group: 'Lotto & Rewards', routes: ['/admin/tournaments'], actions: [view('menu.tournaments.view'), manage('bonuses.write', 'Create / settle')] },

  // ---- Games catalog ----
  { key: 'categories', label: 'Categories', group: 'Games', routes: ['/admin/categories'], actions: [view('menu.categories.view'), edit('categories.write')] },
  { key: 'providers', label: 'Game Providers', group: 'Games', routes: ['/admin/providers'], actions: [view('menu.providers.view'), edit('providers.write')] },

  // ---- Reports & marketing ----
  { key: 'reports', label: 'Reports & Analytics', group: 'Reports & Marketing', routes: ['/admin/reports'], actions: [view('menu.reports.view')] },
  { key: 'marketing', label: 'Marketing', group: 'Reports & Marketing', routes: ['/admin/marketing'], actions: [view('menu.marketing.view')] },
  { key: 'promoCodes', label: 'Promo Codes', group: 'Reports & Marketing', routes: ['/admin/promo-codes'], actions: [view('menu.promoCodes.view'), edit('bonuses.write')] },
  { key: 'campaigns', label: 'Campaigns', group: 'Reports & Marketing', routes: ['/admin/campaigns'], actions: [view('menu.campaigns.view'), edit('settings.write')] },
  { key: 'cashback', label: 'Cashback', group: 'Reports & Marketing', routes: ['/admin/cashback'], actions: [view('menu.cashback.view'), edit('bonuses.write')] },
  { key: 'inAppNotifications', label: 'In-App Notifications', group: 'Reports & Marketing', routes: ['/admin/in-app-notifications'], actions: [view('menu.inAppNotifications.view'), edit('settings.write')] },
  { key: 'notifications', label: 'Notifications', group: 'Reports & Marketing', routes: ['/admin/notifications'], actions: [view('menu.notifications.view'), edit('settings.write')] },
  { key: 'homepageVideos', label: 'Homepage Videos', group: 'Reports & Marketing', routes: ['/admin/homepage-videos'], actions: [view('menu.homepageVideos.view'), edit('homepage.write')] },
  { key: 'tracking', label: 'Tracking Pixels', group: 'Reports & Marketing', routes: ['/admin/tracking'], actions: [view('menu.tracking.view'), edit('settings.write')] },
  { key: 'whatsapp', label: 'WhatsApp', group: 'Reports & Marketing', routes: ['/admin/whatsapp'], actions: [view('menu.whatsapp.view'), edit('settings.write')] },

  // ---- Security & staff ----
  { key: 'security', label: 'Security Center', group: 'Security & Staff', routes: ['/admin/security'], actions: [view('menu.security.view'), manage('security.write', 'Manage IP blocks & 2FA')] },
  { key: 'account', label: 'My Account', group: 'Security & Staff', routes: ['/admin/account'], actions: [], alwaysAllow: true },
  { key: 'passwordResets', label: 'Password Resets', group: 'Security & Staff', routes: ['/admin/password-resets'], actions: [view('menu.passwordResets.view'), edit('security.write')] },
  { key: 'staff', label: 'Staff & Sub-admins', group: 'Security & Staff', routes: ['/admin/staff'], actions: [manage('staff.manage', 'Manage staff')], superAdminOnly: true },

  // ---- System ----
  { key: 'integrations', label: 'Integrations', group: 'System', routes: ['/admin/integrations'], actions: [view('menu.integrations.view'), edit('settings.write')] },
  { key: 'depositPrompt', label: 'Deposit Prompt', group: 'System', routes: ['/admin/deposit-prompt'], actions: [view('menu.depositPrompt.view'), edit('settings.write')] },
  { key: 'support', label: 'Support Messages', group: 'System', routes: ['/admin/support'], actions: [view('menu.support.view'), manage('support.write', 'Reply & resolve')] },
  { key: 'settings', label: 'System Settings', group: 'System', routes: ['/admin/settings'], actions: [view('menu.settings.view'), edit('settings.write')] },
  { key: 'activity', label: 'Activity Log', group: 'System', routes: ['/admin/activity'], actions: [view('menu.activity.view')], superAdminOnly: true },
  { key: 'handover', label: 'Handover', group: 'System', routes: ['/admin/handover'], actions: [view('menu.handover.view'), manage('staff.manage', 'Manage'), ], superAdminOnly: true },
];

// ---- Derived lookups (built once) ----

const SECTION_BY_MENU_KEY = new Map<string, AdminSection>();
for (const s of ADMIN_SECTIONS) SECTION_BY_MENU_KEY.set(s.key, s);

/** The section that owns a given sidebar menu key. */
export function sectionForMenuKey(menuKey: string): AdminSection | undefined {
  return SECTION_BY_MENU_KEY.get(menuKey);
}

/** The section that owns a given /admin pathname (longest route prefix wins). */
export function sectionForPath(pathname: string): AdminSection | undefined {
  let best: AdminSection | undefined;
  let bestLen = -1;
  for (const s of ADMIN_SECTIONS) {
    for (const r of s.routes) {
      if ((pathname === r || pathname.startsWith(r + '/')) && r.length > bestLen) {
        best = s;
        bestLen = r.length;
      }
    }
  }
  return best;
}

/** Every RBAC permission code referenced by a section's actions. */
export function sectionPermissions(section: AdminSection): string[] {
  return Array.from(new Set(section.actions.map((a) => a.permission)));
}

/** The dedicated view/visibility code for a section, if it has one. */
export function sectionViewPermission(section: AdminSection): string | undefined {
  return section.actions.find((a) => a.kind === 'view')?.permission;
}

/**
 * Can this role+permission set VIEW the section at all (see it in the
 * sidebar / open its pages)? Checks ONLY the dedicated view permission (or,
 * for the handful of rows with no separate view code - Staff itself - the
 * first action) so a staff member granted "Deposits: Approve" without
 * "Deposits: View" still doesn't see the row; view is always required.
 */
export function canViewSection(section: AdminSection, role: string, perms: string[]): boolean {
  if (role === 'super_admin') return true;
  if (section.alwaysAllow) return true;
  const viewCode = sectionViewPermission(section) ?? section.actions[0]?.permission;
  if (!viewCode) return true;
  // superAdminOnly means exactly that. Super admins already returned true
  // above, so reaching here with the flag set means a non-super-admin, and
  // the answer is no regardless of what was granted. Previously both
  // branches were identical, which made the flag decorative: Staff &
  // Sub-admins and Handover could be handed to any staff member through the
  // permission picker despite being marked super-admin-only.
  if (section.superAdminOnly) return false;
  return perms.includes(viewCode);
}

/** All permission codes used anywhere in the registry (for validation / picker). */
export function allRegistryPermissions(): string[] {
  const set = new Set<string>();
  for (const s of ADMIN_SECTIONS) for (const c of sectionPermissions(s)) set.add(c);
  return Array.from(set);
}

// ---------------------------------------------------------------------------
// Read permissions implied by a section's View.
//
// The admin data APIs authorise with their own long-standing read codes
// (users.read, deposits.read, ...). NONE of those codes appear as grantable
// actions in the registry above, so the Super Admin panel could never issue
// them: a staff member ticked "User Management: View", saw the menu row
// appear, opened the page and got FORBIDDEN with an empty table. That was
// true for EVERY section, not just User Management - the menu.<key>.view
// codes minted in Phase 5 gate visibility only, and nothing granted the read.
//
// Granting a section's View therefore also grants the read code(s) that
// section's own pages call. Visibility and data access now move together,
// which is what the permission screen already implies to the operator.
//
// KNOWN LIMITATION, deliberately not hidden: several of these codes are
// shared by sibling sections' APIs (users.read alone is required by 21
// routes across native-games, providers, recovery, vip and wingo). So
// granting one section's View can also permit READING a sibling section's
// API directly. Page access is still correctly blocked - the sidebar filter
// and URL guard both key off menu.<key>.view - so this is reachable only by
// calling the API by hand, never by navigating the panel. Closing that gap
// properly means minting a per-section read code and updating those ~60
// routes to check it, which is real work and is NOT done here.
export const SECTION_READ_PERMISSIONS: Record<string, string[]> = {
  users: ['users.read'],
  balance: ['users.read'],
  deposits: ['deposits.read'],
  withdrawals: ['withdrawals.read'],
  transactions: ['transactions.read'],
  payments: ['payments.read'],
  referrals: ['referrals.read'],
  bonuses: ['bonuses.read'],
  affiliate: ['affiliate.read'],
  reports: ['reports.read'],
  security: ['security.read'],
  support: ['support.read'],
  settings: ['settings.read'],
  activity: ['activity.read'],
};

/**
 * View permission codes that, when held, should also grant `permission`.
 * Empty when nothing implies it, so the caller falls through to a normal
 * FORBIDDEN.
 */
export function viewCodesGrantingRead(permission: string): string[] {
  const out: string[] = [];
  for (const section of ADMIN_SECTIONS) {
    if (!SECTION_READ_PERMISSIONS[section.key]?.includes(permission)) continue;
    const viewCode = sectionViewPermission(section);
    if (viewCode) out.push(viewCode);
  }
  return out;
}
