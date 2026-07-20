import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getClientById } from '@/lib/data/clients';
import { getPoliciesForClient } from '@/lib/data/policies';
import { getClientTimeline } from '@/lib/data/timeline';
import { ClientDetailCard } from '@/components/clients/ClientDetailCard';
import { IntelligencePanel } from '@/components/clients/IntelligencePanel';
import { getClientIntelligence } from '@/lib/data/intelligence';
import { QuickLog } from '@/components/clients/QuickLog';
import { ClientPlatformBadge } from '@/components/clients/ClientPlatformBadge';
import { ClientPoliciesSection } from '@/components/clients/ClientPoliciesSection';
import { CustomerTimeline } from '@/components/timeline/CustomerTimeline';
import { DeleteClientDialog } from '@/components/clients/DeleteClientDialog';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

/**
 * Client detail page — the customer 360° view. Composes:
 *  - personal details card
 *  - real policies (Policy Engine)
 *  - the customer timeline (derived from policies + scheduled reminders)
 *  - message history (still a placeholder until the Messaging send pipeline)
 */
export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // PERF: all independent data in parallel — one round-trip wave instead of a
  // four-deep waterfall (this page was the slowest tap in the app on mobile).
  // Timeline depends on policies, so that pair chains inside its own branch.
  const [client, policiesAndTimeline, intel] = await Promise.all([
    getClientById(id),
    (async () => {
      const policies = await getPoliciesForClient(id);
      const timeline = await getClientTimeline(id, policies);
      return { policies, timeline };
    })(),
    getClientIntelligence(id),
  ]);
  if (!client) notFound();
  const { policies, timeline } = policiesAndTimeline;

  return (
    <main className="mx-auto max-w-[960px] p-6 md:p-8">
      <div className="mb-6">
        <Link href="/clients" className="text-sm text-muted-foreground hover:text-primary">
          ← Back to clients
        </Link>
      </div>

      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">{client.full_name}</h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-muted-foreground">
            <span className="tabular-nums">{client.phone_number}</span>
            {client.email ? <span>{client.email}</span> : null}
            <ClientPlatformBadge platform={client.preferred_platform} />
            <span className="text-faint">
              {policies.length} {policies.length === 1 ? 'policy' : 'policies'}
            </span>
          </p>
          <QuickLog clientId={client.id} />
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href={`/clients/${client.id}/edit`}>Edit</Link>
          </Button>
          <DeleteClientDialog clientId={client.id} clientName={client.full_name} />
        </div>
      </div>

      <div className="space-y-6">
        {intel ? <IntelligencePanel view={intel} clientId={client.id} clientName={client.full_name} /> : null}

        <ClientDetailCard client={client} />

        <ClientPoliciesSection clientId={client.id} policies={policies} />

        <section className="rounded-xl bg-card shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_2px_8px_rgba(0,0,0,0.35)] p-6">
          <h2 className="mb-4 text-sm font-semibold">Customer timeline</h2>
          <CustomerTimeline events={timeline} />
        </section>

      </div>
    </main>
  );
}
