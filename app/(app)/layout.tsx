import { AppShell } from '@/components/shell/AppShell';

/**
 * Layout for all authenticated app pages. Wraps them in the AppShell (sidebar +
 * header + agent identity). Login and health live outside this group and stay
 * full-screen. Auth redirects are still enforced by middleware.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
