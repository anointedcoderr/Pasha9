// Built by Anointed Coder.
// Mock signed-in player. No real auth this phase: screens read this object
// directly. Swap for a real session hook in a later phase.

export interface MockUser {
  id: string;
  username: string;
  /** Phone shown masked in the UI, never the raw value. */
  phoneMasked: string;
  avatarUrl: string;
  isLoggedIn: boolean;
  vipTier: string;
  memberSince: string;
}

export const mockUser: MockUser = {
  id: 'usr_sanjid123',
  username: 'sanjid123',
  phoneMasked: '+8801*****4290',
  avatarUrl: 'https://picsum.photos/seed/pasha-avatar/160/160',
  isLoggedIn: true,
  vipTier: 'Gold',
  memberSince: '2025-11-02',
};
