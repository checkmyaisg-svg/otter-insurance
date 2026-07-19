import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getToday } from '@/lib/data/dashboard';
import { SidebarNav } from './SidebarNav';
import { BottomNav } from './BottomNav';
import { CommandPalette } from './CommandPalette';
import { ProspektMark } from '@/components/ui/ProspektMark';
import { logout } from '@/app/login/actions';

const BRAND = 'Prospekt';

/**
 * The application shell: persistent sidebar (desktop) / slide-over (mobile),
 * agent identity + sign-out anchored at the bottom, and the page content area.
 * Server component — reads the agent and the Today "needs attention" count so
 * the Today nav item can show a live badge (the product's heartbeat).
 */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let agentName = 'Agent';
  let agentInitials = 'A';
  let email = '';
  let attention = 0;
  if (user) {
    email = user.email ?? '';
    const { data: agent } = await supabase.from('agents').select('full_name').eq('id', user.id).maybeSingle();
    if (agent?.full_name) {
      agentName = agent.full_name as string;
      agentInitials = initials(agentName);
    }
    try {
      const today = await getToday();
      attention = today.summary.urgent;
    } catch {
      attention = 0;
    }
  }

  const items = [
    { href: '/', label: 'Today', badge: attention },
    { href: '/clients', label: 'Clients' },
    { href: '/policies', label: 'Policies' },
    { href: '/calendar', label: 'Calendar' },
    { href: '/messages', label: 'Messages' },
    { href: '/settings', label: 'Settings' },
  ];
  const mobileItems = [
    { href: '/', label: 'Today', badge: attention },
    { href: '/clients', label: 'Clients' },
    { href: '/messages', label: 'Messages' },
    { href: '/calendar', label: 'Calendar' },
    { href: '/more', label: 'More' },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[228px] shrink-0 flex-col gap-3 bg-sidebar px-3 py-4 md:flex">
        <Link href="/" className="flex items-center gap-2 px-2 py-1">
          <ProspektMark size={20} className="text-foreground" />
          <span className="text-[14px] font-semibold tracking-[-0.01em]">{BRAND}</span>
        </Link>

        <div className="px-1 pb-0.5">
          <div className="flex h-7 items-center justify-between rounded px-1.5 text-[12.5px] text-faint transition-colors duration-150 hover:bg-muted/50">
            <span>Search</span>
            <kbd className="text-[10px] font-medium text-faint">⌘K</kbd>
          </div>
        </div>
        <SidebarNav items={items} />

        {/* Agent identity + sign out, anchored at the bottom */}
        <div className="mt-auto pt-2">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
              {agentInitials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{agentName}</p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            </div>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar — brand + agent avatar (nav lives at the bottom) */}
        <header className="flex items-center justify-between border-b bg-card px-4 py-3 md:hidden">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
              {BRAND[0]}
            </span>
            <span className="text-sm font-semibold">{BRAND}</span>
          </Link>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
            {agentInitials}
          </span>
        </header>

        {/* Content — extra bottom padding on mobile so the tab bar never covers it */}
        <div className="min-w-0 flex-1 overflow-x-hidden pb-20 md:pb-0">{children}</div>
      </div>

      {/* Mobile bottom tab bar */}
      <BottomNav items={mobileItems} />
      <CommandPalette />
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0]![0] ?? 'A').toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase();
}
