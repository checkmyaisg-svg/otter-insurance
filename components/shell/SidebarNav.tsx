'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  emoji: string;
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
              'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <span className="text-base" aria-hidden>
              {item.emoji}
            </span>
            <span className="flex-1">{item.label}</span>
            {item.badge && item.badge > 0 ? (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums',
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
