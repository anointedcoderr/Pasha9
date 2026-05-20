'use client';

import { Bell, Search, Menu, ShieldCheck } from 'lucide-react';
import { LanguageToggle } from '@/components/site/LanguageToggle';
import { Input } from '@/components/ui/Input';
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from '@/components/ui/Dropdown';
import { mockUsers } from '@/lib/mock/users';

export function AdminTopbar({ onMenu }: { onMenu?: () => void }) {
  const admin = mockUsers.find((u) => u.role === 'super_admin') ?? mockUsers[0];

  return (
    <header className="sticky top-0 z-20 flex h-[68px] items-center gap-3 border-b border-neon/10 bg-base-deep/85 px-4 backdrop-blur md:px-6">
      <button
        type="button"
        aria-label="Open menu"
        onClick={onMenu}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neon/15 text-ink-mid hover:text-ink-hi lg:hidden"
      >
        <Menu className="h-4 w-4" />
      </button>

      <div className="hidden md:block md:w-80">
        <Input leftIcon={<Search className="h-4 w-4" />} placeholder="Search users, IDs, references..." />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <LanguageToggle compact />
        <button className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neon/15 text-ink-mid hover:text-ink-hi">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-neon" />
        </button>
        <Dropdown>
          <DropdownTrigger className="flex items-center gap-2 rounded-lg border border-neon/15 px-2 py-1.5 text-sm hover:border-neon/40">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-grad-gold text-xs font-bold text-base-deep">
              {admin.username.slice(0, 2).toUpperCase()}
            </span>
            <span className="hidden text-left md:block">
              <span className="block text-xs text-ink-hi">{admin.username}</span>
              <span className="block text-[10px] uppercase tracking-wider text-gold-300">{admin.role.replace('_', ' ')}</span>
            </span>
          </DropdownTrigger>
          <DropdownContent>
            <DropdownLabel>Account</DropdownLabel>
            <DropdownItem icon={<ShieldCheck className="h-4 w-4 text-neon" />}>My Profile</DropdownItem>
            <DropdownItem>Switch Account</DropdownItem>
            <DropdownSeparator />
            <DropdownItem danger>Log out</DropdownItem>
          </DropdownContent>
        </Dropdown>
      </div>
    </header>
  );
}
