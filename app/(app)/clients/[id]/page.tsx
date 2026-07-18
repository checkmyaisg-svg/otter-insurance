import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getClientById } from '@/lib/data/clients';
import { getPoliciesForClient } from '@/lib/data/policies';
import { getClientTimeline } from '@/lib/data/timeline';
import { ClientDetailCard } from '@/components/clients/ClientDetailCard';
import { ClientPoliciesSection } from '@/components/clients/ClientPoliciesSection';
import { CustomerTimeline } from '@/components/timeline/CustomerTimeline';
import { ClientSectionPlaceholder } from '@/components/clients/ClientSectionPlaceholder';
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
  const client = await getClientById(id);
  if (!client) notFound();

  const policies = await getPoliciesForClient(id);
  const timeline = await getClientTimeline(id, policies);

  return (
    <main className="mx-auto max-w-3xl p-6 md:p-8">
      <div className="mb-6">
        <Link href="/clients" className="text-sm text-muted-foreground hover:text-primary">
          ← Back to clients
        </Link>
      </div>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{client.full_name}</h1>
          <p className="text-sm text-muted-foreground">
            {policies.length} {policies.length === 1 ? 'policy' : 'policies'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href={`/clients/${client.id}/edit`}>Edit</Link>
          </Button>
          <DeleteClientDialog clientId={client.id} clientName={client.full_name} />
        </div>
      </div>

      <div className="space-y-6">
        <ClientDetailCard client={client} />

        <ClientPoliciesSection clientId={client.id} policies={policies} />

        <section className="rounded-lg border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold">Customer timeline</h2>
          <CustomerTimeline events={timeline} />
        </section>

        <ClientSectionPlaceholder
          title="Message history"
          description="Sent and received WhatsApp messages will appear here once messaging is live."
        />
      </div>
    </main>
  );
}
