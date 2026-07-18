import Link from 'next/link';
import { TableCell, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ClientPlatformBadge } from './ClientPlatformBadge';
import { formatDate } from '@/lib/format/display';
import type { ClientListItem } from '@/lib/data/clients';

/**
 * One row in the clients table. Presentational: it renders data and links, and
 * delegates the actual delete to a slot passed in by the parent (so this stays
 * a server-renderable component with no client-side state).
 */
export function ClientRow({
  client,
  deleteSlot,
}: {
  client: ClientListItem;
  deleteSlot: React.ReactNode;
}) {
  return (
    <TableRow>
      <TableCell className="font-medium">
        <Link href={`/clients/${client.id}`} className="hover:text-primary hover:underline">
          {client.full_name}
        </Link>
      </TableCell>
      <TableCell className="tabular-nums text-muted-foreground">{client.phone_number}</TableCell>
      <TableCell className="text-muted-foreground">{formatDate(client.birthday)}</TableCell>
      <TableCell>
        <ClientPlatformBadge platform={client.preferred_platform} />
      </TableCell>
      <TableCell className="tabular-nums">{client.policy_count}</TableCell>
      <TableCell className="text-muted-foreground">{formatDate(client.created_at)}</TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/clients/${client.id}`}>View</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/clients/${client.id}/edit`}>Edit</Link>
          </Button>
          {deleteSlot}
        </div>
      </TableCell>
    </TableRow>
  );
}
