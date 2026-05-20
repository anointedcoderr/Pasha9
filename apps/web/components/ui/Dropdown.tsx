'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/utils/cn';
import { type ReactNode } from 'react';

export const Dropdown = DropdownMenu.Root;
export const DropdownTrigger = DropdownMenu.Trigger;

export function DropdownContent({
  children,
  align = 'end',
  className,
}: {
  children: ReactNode;
  align?: 'start' | 'center' | 'end';
  className?: string;
}) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={8}
        className={cn(
          'z-50 min-w-[180px] rounded-xl border border-neon/15 bg-base-panel/95 p-1.5 shadow-glow backdrop-blur',
          className,
        )}
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}

export function DropdownItem({
  children,
  onSelect,
  danger,
  icon,
}: {
  children: ReactNode;
  onSelect?: () => void;
  danger?: boolean;
  icon?: ReactNode;
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none transition',
        'data-[highlighted]:bg-white/5 data-[highlighted]:text-ink-hi',
        danger ? 'text-signal-danger' : 'text-ink-mid',
      )}
    >
      {icon}
      <span>{children}</span>
    </DropdownMenu.Item>
  );
}

export function DropdownLabel({ children }: { children: ReactNode }) {
  return <div className="px-3 pt-2 text-[11px] uppercase tracking-wider text-ink-lo">{children}</div>;
}

export function DropdownSeparator() {
  return <DropdownMenu.Separator className="my-1.5 h-px bg-neon/10" />;
}
