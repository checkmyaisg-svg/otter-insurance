import { getClients } from '@/lib/data/clients';
import { ClientTable } from '@/components/clients/ClientTable';
import { ClientSearch } from '@/components/clients/ClientSearch';
import { DeleteClientDialog } from '@/components/clients/DeleteClientDialog';
import { ClientsHeaderActions } from '@/components/clients/ClientsHeaderActions';
import { PageHeader } from '@/components/shell/PageHeader';

export const dynamic = 'force-dynamic';

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const search = q ?? '';
  const clients = await getClients(search);

  return (
    <main className="mx-auto max-w-4xl p-6 md:p-8">
      <PageHeader
        title="Clients"
        subtitle={`${clients.length} ${clients.length === 1 ? 'person' : 'people'} in your book`}
        action={<ClientsHeaderActions />}
      />

      <div className="mb-4">
        <ClientSearch initial={search} />
      </div>

      <ClientTable
        clients={clients}
        hasSearch={search !== ''}
        renderDelete={(c) => <DeleteClientDialog clientId={c.id} clientName={c.full_name} />}
      />
    </main>
  );
}
