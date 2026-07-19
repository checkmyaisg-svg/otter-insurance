'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { IconSun, IconUsers, IconFileText, IconSettings, IconCalendarClock, IconMessageCircle, IconInbox } from '@/components/ui/icons';

const NAV_ICON: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Today: IconSun,
  Clients: IconUsers,
  Policies: IconFileText,
  Calendar: IconCalendarClock,
  Messages: IconMessageCircle,
  More: IconInbox,
  Settings: IconSettings,
};

interface NavItem { href: string; label: string; badge?: number }

/**
 * Mobile bottom tab bar — thumb-reachable primary navigation, native-app style.
 * Fixed to the bottom on small screens; hidden at md+ where the sidebar shows.
 * Large tap targets (min 56px tall) for one-handed use.
 */
export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t !border-white/[0.06] bg-sidebar/95 backdrop-blur md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Primary"
    >
      {items.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'relative flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10.5px] font-medium transition-colors duration-150',
              active ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <span className="relative leading-none" aria-hidden>
              {(() => { const Icon = NAV_ICON[item.label] ?? IconFileText; return <Icon size={20} />; })()}
              {item.badge && item.badge > 0 ? (
                <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                  {item.badge}
                </span>
              ) : null}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
