import { createClientRecord } from '@/app/actions/clients';
import { ClientForm, type ClientFormValues } from '@/components/clients/ClientForm';

/**
 * Add Client page. Thin server component: renders the reusable form and hands
 * it the existing createClientRecord server action. Empty optional fields are
 * normalized to undefined so zod's optional() semantics apply cleanly.
 */
export default function NewClientPage() {
  async function submit(values: ClientFormValues) {
    'use server';
    return createClientRecord({
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
        <h1 className="text-2xl font-semibold">Add client</h1>
        <p className="text-sm text-muted-foreground">
          Create a new client record. You can add their policies afterwards.
        </p>
      </div>
      <ClientForm
        submitLabel="Add client"
        successMessage="Client added."
        onSubmit={submit}
      />
    </main>
  );
}
