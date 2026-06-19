// Built by Anointed Coder.
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Menu, ShieldCheck, Settings as SettingsIcon, ClipboardList, LogOut } from 'lucide-react';
import { LanguageToggle } from '@/components/site/LanguageToggle';
import { Input } from '@/components/ui/Input';
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from '@/components/ui/Dropdown';
import { AdminBell } from '@/components/admin/AdminBell';

interface AdminMe {
  username: string;
  role: { key: string; label: string };
}

export function AdminTopbar({ onMenu }: { onMenu?: () => void }) {
  const router = useRouter();
  const [me, setMe] = useState<AdminMe | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive && data?.user) setMe(data.user as AdminMe);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore network errors, still redirect to login
    }
    router.replace('/admin/login');
    router.refresh();
  };

  const initials = (me?.username ?? '??').slice(0, 2).toUpperCase();
  const roleLabel = me?.role?.label ?? (me?.role?.key ? me.role.key.replace('_', ' ') : 'staff');

  return (
    <header className="sticky top-0 z-20 flex h-[68px] items-center gap-3 border-b border-brand-divider bg-brand-paper px-4 md:px-6">
      <button
        type="button"
        aria-label="Open menu"
        onClick={onMenu}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-brand-divider text-brand-inkSoft hover:text-brand-ink lg:hidden"
      >
        <Menu className="h-4 w-4" />
      </button>

      <div className="hidden md:block md:w-80">
        <Input leftIcon={<Search className="h-4 w-4" />} placeholder="Search users, IDs, references..." />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <LanguageToggle compact />
        <AdminBell />
        <Dropdown>
          <DropdownTrigger asChild>
            <button
              type="button"
              aria-label="Account menu"
              className="flex items-center gap-2 rounded-lg border border-brand-divider px-2 py-1.5 text-sm transition hover:border-brand-yellow-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-grad-yellow text-xs font-bold text-brand-ink">
                {initials}
              </span>
              <span className="hidden text-left md:block">
                <span className="block text-xs text-brand-ink">{me?.username ?? 'admin'}</span>
                <span className="block text-[10px] uppercase tracking-wider text-brand-yellow-700">{roleLabel}</span>
              </span>
            </button>
          </DropdownTrigger>
          <DropdownContent>
            <DropdownLabel>Account</DropdownLabel>
            <DropdownItem icon={<ShieldCheck className="h-4 w-4 text-brand-yellow-700" />} onSelect={() => router.push('/admin/profile')}>
              Profile
            </DropdownItem>
            <DropdownItem icon={<SettingsIcon className="h-4 w-4 text-brand-inkSoft" />} onSelect={() => router.push('/admin/settings')}>
              Settings
            </DropdownItem>
            <DropdownItem icon={<ClipboardList className="h-4 w-4 text-brand-inkSoft" />} onSelect={() => router.push('/admin/activity')}>
              Activity Log
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem danger icon={<LogOut className="h-4 w-4" />} onSelect={logout}>
              Logout
            </DropdownItem>
          </DropdownContent>
        </Dropdown>
      </div>
    </header>
  );
}
