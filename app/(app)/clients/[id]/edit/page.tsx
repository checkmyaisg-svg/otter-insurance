import { notFound } from 'next/navigation';
import { getClientById } from '@/lib/data/clients';
import { updateClientRecord } from '@/app/actions/clients';
import { ClientForm, type ClientFormValues } from '@/components/clients/ClientForm';

/**
 * Edit Client page. Fetches the client (RLS-scoped), prefills the shared
 * ClientForm, and wires updateClientRecord — passing the id + version so the
 * server action's optimistic-lock check can detect concurrent edits.
 */
export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClientById(id);
  if (!client) notFound();

  async function submit(values: ClientFormValues) {
    'use server';
    return updateClientRecord({
      id: client!.id,
      expected_version: client!.version,
      full_name: values.full_name,
      phone_number: values.phone_number,
      email: values.email || undefined,
      birthday: values.birthday || undefined,
      preferred_platform: values.preferred_platform,
      notes: values.notes || undefined,
    });
  }

  return (
    <main className="mx-auto max-w-xl p-6 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Edit client</h1>
        <p className="text-sm text-muted-foreground">Update {client.full_name}&apos;s details.</p>
      </div>
      <ClientForm
        initial={{
          full_name: client.full_name,
          phone_number: client.phone_number,
          email: client.email ?? '',
          birthday: client.birthday ?? '',
          preferred_platform: client.preferred_platform,
          notes: client.notes ?? '',
        }}
        submitLabel="Save changes"
        successMessage="Client updated."
        onSubmit={submit}
      />
    </main>
  );
}
