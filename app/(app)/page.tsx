import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getToday } from '@/lib/data/dashboard';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { DashboardStats } from '@/components/dashboard/DashboardStats';
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
    <main className="mx-auto max-w-2xl p-6 md:p-8">
      <DashboardHeader data={data} />
      <DashboardStats stats={data.stats} />

      {hasAnyItems ? (
        <div className="space-y-4">
          {data.sections.map((section) => (
            <ActionSection key={section.key} section={section} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed bg-card p-12 text-center">
          <p className="text-3xl" aria-hidden>✅</p>
          <p className="mt-3 text-sm font-medium">You&apos;re all caught up.</p>
          <p className="mt-1 text-sm text-muted-foreground">Nothing needs your attention right now.</p>
        </div>
      )}
    </main>
  );
}
