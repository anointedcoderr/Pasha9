// Built by Anointed Coder.
//
// Friendly, section-based presentation of the raw admin permission catalog.
//
// The RBAC keys stay exactly as seeded (deposits.review, affiliate.write, ...);
// nothing here changes enforcement. This module only maps each technical key to
// a human sidebar-section name plus a plain action label, so the Super Admin
// grants access as "Deposits > Approve" instead of reading "deposits.review".
// Every friendly action still maps 1:1 to a real permission the API enforces.

export type PermissionActionKind = 'view' | 'approve' | 'adjust' | 'tiers' | 'manage' | 'other';

interface KeyMeta {
  section: string; // friendly sidebar-section name
  action: string; // plain action label
  kind: PermissionActionKind;
}

// Sections render in this order (mirrors the admin sidebar grouping).
export const SECTION_ORDER: string[] = [
  'Deposits',
  'Withdrawals',
  'Transactions',
  'Payments',
  'Payouts',
  'Payment Methods',
  'User Management',
  'Balance Management',
  'Referrals',
  'Affiliate',
  'Bonus Management',
  'Lottery',
  'Rewards & Spin',
  'Games',
  'Website Customization',
  'Reports & Analytics',
  'Player Recovery',
  'Support',
  'Security Center',
  'Staff & Sub-admins',
  'System Settings',
  'Activity Log',
];

// Actions within a section render in this order (View first, Full access last).
const ACTION_RANK: Record<PermissionActionKind, number> = {
  view: 0,
  approve: 1,
  adjust: 2,
  tiers: 3,
  manage: 4,
  other: 5,
};

// Exact-key mapping. Keys not listed fall back to a derived section + action.
const KEY_META: Record<string, KeyMeta> = {
  'deposits.read': { section: 'Deposits', action: 'View', kind: 'view' },
  'deposits.review': { section: 'Deposits', action: 'Approve / reject', kind: 'approve' },
  'withdrawals.read': { section: 'Withdrawals', action: 'View', kind: 'view' },
  'withdrawals.review': { section: 'Withdrawals', action: 'Approve / reject', kind: 'approve' },
  'transactions.read': { section: 'Transactions', action: 'View', kind: 'view' },
  'payments.read': { section: 'Payments', action: 'View', kind: 'view' },
  'payouts.read': { section: 'Payouts', action: 'View', kind: 'view' },
  'payment_methods.read': { section: 'Payment Methods', action: 'View', kind: 'view' },
  'users.read': { section: 'User Management', action: 'View', kind: 'view' },
  'users.update': { section: 'User Management', action: 'Edit accounts', kind: 'manage' },
  'users.write': { section: 'User Management', action: 'Full access', kind: 'manage' },
  'users.balance.adjust': { section: 'Balance Management', action: 'Adjust balance', kind: 'adjust' },
  'balance.write': { section: 'Balance Management', action: 'Adjust & reverse', kind: 'manage' },
  'referrals.read': { section: 'Referrals', action: 'View', kind: 'view' },
  'referrals.write': { section: 'Referrals', action: 'Approve & adjust', kind: 'manage' },
  'affiliate.read': { section: 'Affiliate', action: 'View', kind: 'view' },
  'affiliate.write': { section: 'Affiliate', action: 'Approve & manage', kind: 'manage' },
  'affiliate.tiers.write': { section: 'Affiliate', action: 'Commission tiers', kind: 'tiers' },
  'bonus.write': { section: 'Bonus Management', action: 'Manage (legacy)', kind: 'manage' },
  'bonuses.read': { section: 'Bonus Management', action: 'View', kind: 'view' },
  'bonuses.write': { section: 'Bonus Management', action: 'Full access', kind: 'manage' },
  'lotto.write': { section: 'Lottery', action: 'Manage draws', kind: 'manage' },
  'rewards.write': { section: 'Rewards & Spin', action: 'Manage rewards, spin & betting pass', kind: 'manage' },
  'categories.write': { section: 'Games', action: 'Manage categories', kind: 'manage' },
  'providers.write': { section: 'Games', action: 'Manage providers', kind: 'manage' },
  'games.write': { section: 'Games', action: 'Manage games', kind: 'manage' },
  'banners.write': { section: 'Website Customization', action: 'Banners', kind: 'manage' },
  'popups.write': { section: 'Website Customization', action: 'Popups', kind: 'manage' },
  'promo.write': { section: 'Website Customization', action: 'Promo text', kind: 'manage' },
  'homepage.write': { section: 'Website Customization', action: 'Homepage content', kind: 'manage' },
  'ambassador.write': { section: 'Website Customization', action: 'Ambassador & video', kind: 'manage' },
  'reports.read': { section: 'Reports & Analytics', action: 'View', kind: 'view' },
  'recovery.write': { section: 'Player Recovery', action: 'Run recovery', kind: 'manage' },
  'support.read': { section: 'Support', action: 'View', kind: 'view' },
  'support.write': { section: 'Support', action: 'Reply & resolve', kind: 'manage' },
  'security.read': { section: 'Security Center', action: 'View', kind: 'view' },
  'security.write': { section: 'Security Center', action: 'Manage IP blocks & 2FA', kind: 'manage' },
  'staff.manage': { section: 'Staff & Sub-admins', action: 'Manage staff', kind: 'manage' },
  'settings.read': { section: 'System Settings', action: 'View', kind: 'view' },
  'settings.write': { section: 'System Settings', action: 'Edit settings', kind: 'manage' },
  'activity.read': { section: 'Activity Log', action: 'View', kind: 'view' },
};

// Fallback section for a raw catalog group, used only when a key is not in
// KEY_META (e.g. a permission added later without a mapping here).
const GROUP_SECTION: Record<string, string> = {
  users: 'User Management',
  wallet: 'Payments',
  content: 'Website Customization',
  games: 'Games',
  bonus: 'Bonus Management',
  referrals: 'Referrals',
  affiliate: 'Affiliate',
  system: 'System Settings',
  security: 'Security Center',
  recovery: 'Player Recovery',
  support: 'Support',
};

function titleCase(s: string): string {
  return s.replace(/[_.]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim();
}

function deriveMeta(key: string, group: string, label: string): KeyMeta {
  const section = GROUP_SECTION[group] ?? titleCase(group || 'Other');
  const suffix = key.split('.').slice(1).join('.');
  if (suffix === 'read') return { section, action: 'View', kind: 'view' };
  if (suffix === 'review') return { section, action: 'Approve / reject', kind: 'approve' };
  if (suffix === 'write' || suffix === 'update' || suffix === 'manage') return { section, action: 'Full access', kind: 'manage' };
  // Last resort: use the seeded human label so nothing renders as a bare code.
  return { section, action: label || titleCase(suffix), kind: 'other' };
}

export function metaForPermission(key: string, group: string, label: string): KeyMeta {
  return KEY_META[key] ?? deriveMeta(key, group, label);
}

export interface PermissionLike {
  id: string;
  key: string;
  label: string;
  group: string;
}

export interface SectionAction {
  id: string;
  key: string;
  actionLabel: string;
  kind: PermissionActionKind;
}

export interface PermissionSection {
  section: string;
  actions: SectionAction[];
}

/** Group the raw permission catalog into ordered, friendly sidebar sections. */
export function groupPermissionsBySection(perms: PermissionLike[]): PermissionSection[] {
  const bySection = new Map<string, SectionAction[]>();
  for (const p of perms) {
    const meta = metaForPermission(p.key, p.group, p.label);
    const arr = bySection.get(meta.section) ?? [];
    arr.push({ id: p.id, key: p.key, actionLabel: meta.action, kind: meta.kind });
    bySection.set(meta.section, arr);
  }
  const known = SECTION_ORDER.filter((s) => bySection.has(s));
  const extras = Array.from(bySection.keys())
    .filter((s) => !SECTION_ORDER.includes(s))
    .sort((a, b) => a.localeCompare(b));
  const ordered = [...known, ...extras];
  return ordered.map((section) => ({
    section,
    actions: (bySection.get(section) ?? []).sort(
      (a, b) => ACTION_RANK[a.kind] - ACTION_RANK[b.kind] || a.actionLabel.localeCompare(b.actionLabel),
    ),
  }));
}
