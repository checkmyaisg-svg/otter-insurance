'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { IconSun, IconUsers, IconFileText, IconSettings, IconCalendarClock, IconMessageCircle, IconInbox } from '@/components/ui/icons';

/** label -> icon (nav identity lives here; AppShell's emoji field is ignored). */
const NAV_ICON: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Today: IconSun,
  Clients: IconUsers,
  Policies: IconFileText,
  Calendar: IconCalendarClock,
  Messages: IconMessageCircle,
  More: IconInbox,
  Settings: IconSettings,
};

interface NavItem {
  href: string;
  label: string;
  /** Optional live count (e.g. Today's items needing attention). */
  badge?: number;
}

/**
 * Primary navigation. Highlights the active section by matching the pathname.
 * A route is active if the path equals it or is nested under it (so /clients/123
 * keeps "Clients" active). Today is exact-match only.
 */
export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="flex flex-1 flex-col gap-1">
      {items.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'group relative flex h-8 items-center gap-2.5 rounded px-2.5 text-[13.5px] transition-colors duration-150',
              active
                ? 'bg-muted font-medium text-foreground'
                : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground',
            )}
          >
            {active ? (
              <span className="absolute -left-3 h-4 w-0.5 rounded-full bg-primary" aria-hidden />
            ) : null}
            {(() => {
              const Icon = NAV_ICON[item.label] ?? IconFileText;
              return <Icon size={16} className={active ? 'text-foreground' : 'text-faint group-hover:text-muted-foreground'} />;
            })()}
            <span className="flex-1">{item.label}</span>
            {item.badge && item.badge > 0 ? (
              <span
                className={cn(
                  'rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
                  active ? 'bg-primary text-primary-foreground' : 'bg-destructive/10 text-destructive',
                )}
              >
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
