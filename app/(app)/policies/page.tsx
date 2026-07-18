import Link from 'next/link';
import { getPolicies } from '@/lib/data/policies';
import { PolicyTable } from '@/components/policies/PolicyTable';
import { PageHeader } from '@/components/shell/PageHeader';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function PoliciesPage() {
  const policies = await getPolicies();
  const active = policies.filter((p) => p.status === 'active').length;

  return (
    <main className="mx-auto max-w-4xl p-6 md:p-8">
      <PageHeader
        title="Policies"
        subtitle={`${policies.length} total · ${active} active`}
        action={
          <Button asChild>
            <Link href="/policies/new">Add policy</Link>
          </Button>
        }
      />
      <PolicyTable policies={policies} />
    </main>
  );
}
