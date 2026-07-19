import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getToday } from '@/lib/data/dashboard';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { IconInbox } from '@/components/ui/icons';
import { ActionSection } from '@/components/dashboard/ActionSection';

export const dynamic = 'force-dynamic';

/**
 * Today dashboard — the agent's daily workspace and home. Pure renderer; all
 * logic lives in getToday(). Sections render in priority order and hide when
 * empty; a calm "all caught up" state shows when nothing is actionable.
 */
export default async function TodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const data = await getToday();
  const hasAnyItems = data.sections.some((s) => s.items.length > 0);

  return (
    <main className="mx-auto max-w-[960px] p-6 md:p-8">
      <DashboardHeader data={data} />
      <DashboardStats stats={data.stats} />

      {hasAnyItems ? (
        <div className="space-y-5 ds-stagger">
          {data.sections.map((section) => (
            <ActionSection key={section.key} section={section} />
          ))}
        </div>
      ) : (
        <div className="ds-enter rounded-lg bg-muted/50 p-12 text-center">
          <IconInbox size={20} className="mx-auto text-faint" />
          <p className="mt-3 text-[13.5px] font-medium">You&apos;re all caught up.</p>
          <p className="mt-1 text-[13.5px] text-muted-foreground">Nothing needs your attention right now.</p>
        </div>
      )}
    </main>
  );
}
