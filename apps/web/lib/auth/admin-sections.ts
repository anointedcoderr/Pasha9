// Built by Anointed Coder.
//
// UNIFIED ADMIN SECTION REGISTRY - the single source of truth for the admin
// permission system.
//
// Every admin sidebar menu item belongs to exactly one friendly "section"
// (Deposits, Withdrawals, User Management, ...). Each section declares:
//   - label     : the human name shown to the Super Admin (matches the sidebar)
//   - group     : the sidebar group it renders under
//   - menuKeys  : the AdminSidebar item keys this section owns
//   - routes    : the /admin route prefixes this section owns
//   - actions   : the granular controls (View / Add / Edit / Approve / Delete)
//                 each mapped to the exact RBAC permission code it grants
//   - superAdminOnly / alwaysAllow : access flags
//
// This ONE file drives all of:
//   1. The Super Admin permission screen (friendly names + per-section toggles)
//   2. The admin sidebar (a staff member only sees sections they can view)
//   3. The URL guard (direct access to an unpermitted page is blocked)
//   4. The backend reconciliation target (Phase 4 aligns each API route to the
//      permission its section advertises here)
//
// Design notes:
//   - The RBAC codes below are the EXISTING seeded permission keys. A few
//     sections advertise a "clean" code (e.g. Payment Providers -> payments.read
//     for View) that the API does not yet enforce; those are marked
//     `NEEDS_API_ALIGN` and are reconciled in Phase 4 so the menu permission and
//     the API permission always agree.
//   - "Full access" is not a stored code; it means "grant every action
//     permission in this section". The UI computes it from `actions`.
//   - Config over hardcoding: adding a future admin page is one new menuKey +
//     route on the right section here, and the sidebar, picker and guard all
//     update together.

export type SectionActionKind = 'view' | 'create' | 'edit' | 'approve' | 'delete' | 'manage' | 'tiers' | 'adjust';

export interface SectionAction {
  /** Stable control kind, drives ordering + the toggle rendered. */
  kind: SectionActionKind;
  /** Friendly control label shown to the Super Admin. */
  label: string;
  /** The RBAC permission code this control grants (must exist in the catalog). */
  permission: string;
  /**
   * True when this permission is advertised here but the API route does not yet
   * enforce it (or enforces a broader code). Phase 4 aligns the route to this.
   */
  needsApiAlign?: boolean;
}

export interface AdminSection {
  /** Stable section key. */
  key: string;
  /** Human section name shown to the Super Admin (matches the sidebar). */
  label: string;
  /** Sidebar group this section renders under, for the picker layout. */
  group: string;
  /** Lucide icon name (resolved to a component in the UI layer). */
  icon: string;
  /** AdminSidebar item keys owned by this section. */
  menuKeys: string[];
  /** /admin route prefixes owned by this section (longest-prefix match). */
  routes: string[];
  /** Granular controls; empty when the section is open to any staff member. */
  actions: SectionAction[];
  /** Only the Super Admin can be granted this section (Staff management). */
  superAdminOnly?: boolean;
  /** Open to any signed-in admin/staff, no permission required (Dashboard). */
  alwaysAllow?: boolean;
}

const view = (permission: string, needsApiAlign = false): SectionAction =>
  ({ kind: 'view', label: 'View', permission, needsApiAlign });
const approve = (permission: string): SectionAction =>
  ({ kind: 'approve', label: 'Approve / reject', permission });
const edit = (permission: string): SectionAction =>
  ({ kind: 'edit', label: 'Edit', permission });
const manage = (permission: string, label = 'Full access', needsApiAlign = false): SectionAction =>
  ({ kind: 'manage', label, permission, needsApiAlign });

// The ordered section catalog. Order mirrors the admin sidebar top to bottom.
export const ADMIN_SECTIONS: AdminSection[] = [
  {
    key: 'dashboard', label: 'Dashboard', group: 'Overview', icon: 'LayoutDashboard',
    menuKeys: ['overview'], routes: ['/admin'], actions: [], alwaysAllow: true,
  },

  // ---- Operations ----
  {
    key: 'deposits', label: 'Deposits', group: 'Operations', icon: 'ArrowDownToLine',
    menuKeys: ['deposits', 'depositNotice', 'depositPrompt'],
    routes: ['/admin/deposits', '/admin/deposit-notice', '/admin/deposit-prompt'],
    actions: [view('deposits.read'), approve('deposits.review')],
  },
  {
    key: 'withdrawals', label: 'Withdrawals', group: 'Operations', icon: 'ArrowUpToLine',
    menuKeys: ['withdrawals', 'withdrawalLimits'],
    routes: ['/admin/withdrawals', '/admin/withdrawal-limits'],
    actions: [view('withdrawals.read'), approve('withdrawals.review')],
  },
  {
    key: 'transactions', label: 'Transaction Log', group: 'Operations', icon: 'ReceiptText',
    menuKeys: ['transactions'], routes: ['/admin/transactions'],
    // Was users.read (a mismatch the original seed did not intend - staff's
    // default baseline already includes transactions.read). Phase 4 fixes the
    // API to match.
    actions: [view('transactions.read')],
  },
  {
    key: 'payment_providers', label: 'Payment Providers', group: 'Operations', icon: 'Wallet',
    menuKeys: ['payments', 'payouts', 'paymentMethods', 'paymentsReconciliation'],
    routes: ['/admin/payments', '/admin/payouts', '/admin/payment-methods', '/admin/payments/reconciliation'],
    // Viewing any of the 4 pages under this section previously required
    // settings.write (a super-admin-only code, since 'admin' role deliberately
    // excludes settings.write) - meaning 'admin' role could not view configured
    // gateways at all. Phase 4 moves all 4 GET routes to payments.read, which
    // 'admin' already holds. Mutations (saving credentials) correctly stay on
    // settings.write - reserved for Super Admin by design.
    actions: [view('payments.read'), manage('settings.write', 'Configure providers')],
  },
  {
    key: 'operations', label: 'Operations Monitor', group: 'Operations', icon: 'AlertTriangle',
    menuKeys: ['operations'], routes: ['/admin/operations'],
    // Verified against api/admin/operations/stuck-transactions, the one
    // concrete endpoint behind this page today.
    actions: [view('deposits.review')],
  },

  // ---- Users, balance, referrals ----
  {
    key: 'users', label: 'User Management', group: 'Users & Money', icon: 'Users',
    menuKeys: ['users'], routes: ['/admin/users'],
    actions: [view('users.read'), edit('users.update'), manage('users.write')],
  },
  {
    key: 'balance', label: 'Balance Management', group: 'Users & Money', icon: 'Wallet',
    menuKeys: ['balance'], routes: ['/admin/balance'],
    actions: [
      { kind: 'adjust', label: 'Adjust balance', permission: 'users.balance.adjust' },
      manage('balance.write', 'Adjust & reverse', true),
    ],
  },
  {
    key: 'referrals', label: 'Referrals', group: 'Users & Money', icon: 'Network',
    menuKeys: ['referrals', 'referralClaims'],
    routes: ['/admin/referrals', '/admin/referral-claims'],
    // Verified against apps/web/app/api/admin/referrals/overview + referral-claims
    // routes. Approving a claim previously only checked users.read (a view-level
    // code guarding a money-adjacent decision) - Phase 4 tightens it to
    // referrals.write, which is what "Approve & adjust" is meant to gate.
    actions: [view('referrals.read'), manage('referrals.write', 'Approve & adjust')],
  },
  {
    key: 'recovery', label: 'Player Recovery', group: 'Users & Money', icon: 'HeartHandshake',
    menuKeys: ['recovery'], routes: ['/admin/recovery'],
    // recovery.write is seeded but no route enforces it. Every recovery route
    // actually checks users.read (view) / users.update (mutate) today; matching
    // the registry to that reality (rather than forcing an unused code) avoids
    // silently locking out the default 'staff' role, which already holds
    // users.read.
    actions: [view('users.read'), manage('users.update', 'Run recovery workflows')],
  },

  // ---- Bonus, affiliate, VIP ----
  {
    key: 'bonuses', label: 'Bonus Management', group: 'Bonus & Affiliate', icon: 'Gift',
    menuKeys: ['bonuses', 'depositBonusTiers', 'promotionBanners', 'promoCodes', 'cashback'],
    routes: ['/admin/bonuses', '/admin/deposit-bonus-tiers', '/admin/promotions', '/admin/promo-codes', '/admin/cashback'],
    actions: [view('bonuses.read'), manage('bonuses.write')],
  },
  {
    key: 'affiliate', label: 'Affiliate', group: 'Bonus & Affiliate', icon: 'Briefcase',
    menuKeys: ['affiliate', 'affiliateTiers'],
    routes: ['/admin/affiliate', '/admin/affiliate-tiers'],
    actions: [
      view('affiliate.read'), manage('affiliate.write', 'Approve & manage'),
      { kind: 'tiers', label: 'Commission tiers', permission: 'affiliate.tiers.write' },
    ],
  },
  {
    key: 'vip', label: 'VIP Club', group: 'Bonus & Affiliate', icon: 'Crown',
    menuKeys: ['vip'], routes: ['/admin/vip'],
    // Verified: vip/applications (view + approve) checks users.read; vip/tiers
    // (the tier ladder config) checks settings.write. Two distinct real actions.
    actions: [
      { kind: 'approve', label: 'Review applications', permission: 'users.read' },
      manage('settings.write', 'Manage tier ladder'),
    ],
  },

  // ---- Website / content ----
  {
    key: 'website', label: 'Website Customization', group: 'Content & Media', icon: 'Globe',
    menuKeys: [
      'website', 'banners', 'popups', 'welcomePopup', 'promoText', 'homepage',
      'homepageSections', 'homepageBlocks', 'homepagePromoPair', 'homepageShortcuts',
      'homepageVideos', 'sportsEvents', 'ambassador', 'brandAmbassadors', 'sponsors',
      'publicPaymentMethods', 'socialLinks',
    ],
    routes: [
      '/admin/website', '/admin/banners', '/admin/popups', '/admin/welcome-popup',
      '/admin/promo-text', '/admin/homepage', '/admin/homepage-sections', '/admin/homepage-blocks',
      '/admin/homepage-promo-pair', '/admin/homepage-shortcuts', '/admin/homepage-videos',
      '/admin/sports-events', '/admin/ambassador', '/admin/brand-ambassadors', '/admin/sponsors',
      '/admin/public-payment-methods', '/admin/social-links',
    ],
    // One friendly section, but each content type genuinely has its own seeded
    // permission code (verified against every route file under this menu
    // group) - collapsing them into a single toggle would either over-grant
    // (one code unlocking everything) or under-grant (a real code nobody
    // could ever satisfy). "Full access" still selects all of them together.
    actions: [
      manage('banners.write', 'Banners'),
      manage('popups.write', 'Popups'),
      manage('homepage.write', 'Homepage content (sections, blocks, shortcuts, videos, sports)'),
      manage('promo.write', 'Promo text'),
      manage('ambassador.write', 'Ambassador & promo video'),
      { kind: 'view', label: 'View general site settings', permission: 'settings.read' },
      manage('settings.write', 'Sponsors, social links & other site config'),
    ],
  },

  // ---- Lottery, rewards, spin, wingo ----
  {
    key: 'lottery', label: 'Lottery', group: 'Lotto & Rewards', icon: 'Ticket',
    menuKeys: ['lotto', 'lottoBanners'],
    routes: ['/admin/lotto', '/admin/lotto-banners'],
    actions: [manage('lotto.write', 'Manage draws')],
  },
  {
    key: 'rewards', label: 'Rewards & Betting Pass', group: 'Lotto & Rewards', icon: 'Trophy',
    menuKeys: ['rewards', 'rewardClaims', 'bettingPass', 'bettingPassBanners'],
    routes: ['/admin/rewards', '/admin/reward-claims', '/admin/betting-pass'],
    actions: [manage('rewards.write', 'Manage rewards & betting pass')],
  },
  {
    key: 'spin', label: 'Spin Wheel', group: 'Lotto & Rewards', icon: 'Sparkles',
    menuKeys: ['spinTiers', 'spinSegments'],
    routes: ['/admin/spin-tiers', '/admin/spin-segments'],
    actions: [manage('rewards.write', 'Manage spin wheel')],
  },
  {
    key: 'wingo', label: 'WinGo', group: 'Lotto & Rewards', icon: 'Dices',
    menuKeys: ['wingo', 'tournaments'],
    routes: ['/admin/wingo', '/admin/tournaments'],
    // Verified: wingo round data (GET) checks users.read; the WinGo on/off
    // master switch (POST) checks settings.write. Tournaments run on the SAME
    // codes as Bonus Management (bonuses.read/write) because they pay real
    // prize money through the bonus engine - granting "Manage tournaments"
    // here also grants Bonus Management's "Full access" and vice versa, since
    // it is genuinely the same underlying permission, not a UI quirk.
    actions: [
      view('users.read'),
      manage('settings.write', 'Turn WinGo on/off'),
      { kind: 'view', label: 'View tournaments', permission: 'bonuses.read' },
      manage('bonuses.write', 'Manage tournaments'),
    ],
  },

  // ---- Games catalogue ----
  {
    key: 'games', label: 'Games Catalog', group: 'Games', icon: 'Boxes',
    menuKeys: ['categories', 'providers', 'nativeGames'],
    routes: ['/admin/categories', '/admin/providers', '/admin/native-games'],
    // categories.write is genuinely wired and enforced. providers.write /
    // games.write are seeded but unused by any route today; the provider /
    // native-games integration is the exact subsystem behind a recent live
    // balance incident (encrypted callback secrets, AES keys), so Phase 4
    // deliberately leaves that code path untouched rather than reconciling it
    // under time pressure. View/manage reflect what those routes really check
    // (a mix of users.read reads and settings.write writes) so granting
    // access here actually works instead of silently doing nothing.
    actions: [
      manage('categories.write', 'Manage categories'),
      view('users.read'),
      manage('settings.write', 'Manage providers & games'),
    ],
  },

  // ---- Reports, marketing ----
  {
    key: 'reports', label: 'Reports & Analytics', group: 'Reports & Marketing', icon: 'BarChart3',
    menuKeys: ['reports', 'tracking'],
    routes: ['/admin/reports', '/admin/tracking'],
    actions: [view('reports.read')],
  },
  {
    key: 'marketing', label: 'Marketing & Notifications', group: 'Reports & Marketing', icon: 'Megaphone',
    menuKeys: ['marketing', 'campaigns', 'inAppNotifications', 'notifications', 'whatsapp'],
    routes: ['/admin/marketing', '/admin/campaigns', '/admin/in-app-notifications', '/admin/notifications', '/admin/whatsapp'],
    // Verified: campaigns + notifications both split settings.read (view) /
    // settings.write (manage); WhatsApp settings has no separate read, so
    // viewing it also needs settings.write.
    actions: [view('settings.read'), manage('settings.write', 'Manage campaigns & notifications')],
  },

  // ---- Support, security, staff ----
  {
    key: 'support', label: 'Support', group: 'Security & Staff', icon: 'LifeBuoy',
    menuKeys: ['support'], routes: ['/admin/support'],
    actions: [view('support.read'), manage('support.write', 'Reply & resolve')],
  },
  {
    key: 'security', label: 'Security Center', group: 'Security & Staff', icon: 'ShieldCheck',
    menuKeys: ['security', 'passwordResets'],
    routes: ['/admin/security', '/admin/password-resets'],
    actions: [view('security.read'), manage('security.write', 'Manage IP blocks & 2FA')],
  },
  {
    key: 'staff', label: 'Staff & Sub-admins', group: 'Security & Staff', icon: 'Users',
    menuKeys: ['staff', 'handover'],
    routes: ['/admin/staff', '/admin/handover'],
    actions: [manage('staff.manage', 'Manage staff')],
    superAdminOnly: true,
  },

  // ---- System ----
  {
    key: 'settings', label: 'System Settings', group: 'System', icon: 'Settings',
    menuKeys: ['settings', 'integrations'],
    routes: ['/admin/settings', '/admin/integrations'],
    // Integrations (snapshot/export) is read-only today - both its endpoints
    // check activity.read, with no mutate route at all.
    actions: [view('settings.read'), edit('settings.write'), { kind: 'view', label: 'View integrations', permission: 'activity.read' }],
  },
  {
    key: 'activity', label: 'Activity Log', group: 'System', icon: 'ClipboardList',
    menuKeys: ['activity'], routes: ['/admin/activity'],
    actions: [view('activity.read')],
  },
  {
    key: 'account', label: 'My Account', group: 'System', icon: 'KeyRound',
    menuKeys: ['account'], routes: ['/admin/account'], actions: [], alwaysAllow: true,
  },
];

// ---- Derived lookups (built once) ----

const SECTION_BY_MENU_KEY = new Map<string, AdminSection>();
for (const s of ADMIN_SECTIONS) for (const k of s.menuKeys) SECTION_BY_MENU_KEY.set(k, s);

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
        // '/admin' (dashboard) is the shortest prefix and only wins when
        // nothing more specific matches.
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

/**
 * The permission code(s) that gate SEEING the section (menu + page access),
 * as opposed to any finer action inside it. When a section has a distinct
 * "view" action (Deposits: View vs Approve), only that permission opens the
 * page - matching how a staff member who can only approve should not be the
 * one who opens a page they cannot otherwise browse without also holding
 * View. When a section has no separate view action (most content/manage-only
 * sections), holding ANY of its action permissions is enough to see it.
 */
export function sectionViewPermissions(section: AdminSection): string[] {
  const viewActions = section.actions.filter((a) => a.kind === 'view');
  return viewActions.length > 0
    ? viewActions.map((a) => a.permission)
    : sectionPermissions(section);
}

/**
 * Can this role+permission set VIEW the section at all (see it in the sidebar /
 * open its pages)? True when the role is super_admin, the section is always
 * allowed, or the holder has one of the section's view-gating permissions. A
 * superAdminOnly section is only viewable by a super admin unless the holder
 * was explicitly granted one of its permissions.
 */
export function canViewSection(section: AdminSection, role: string, perms: string[]): boolean {
  if (role === 'super_admin') return true;
  if (section.alwaysAllow) return true;
  const codes = sectionViewPermissions(section);
  if (codes.length === 0) return true;
  return codes.some((c) => perms.includes(c));
}

/** All permission codes used anywhere in the registry (for validation / picker). */
export function allRegistryPermissions(): string[] {
  const set = new Set<string>();
  for (const s of ADMIN_SECTIONS) for (const c of sectionPermissions(s)) set.add(c);
  return Array.from(set);
}
