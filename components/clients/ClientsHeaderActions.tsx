'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ImportContacts } from './ImportContacts';

/**
 * Header actions for the Clients page: "Import contacts" (opens the import
 * flow) and "Add client". Client component so it can own the modal state; the
 * page stays a server component.
 */
export function ClientsHeaderActions() {
  const [importing, setImporting] = React.useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setImporting(true)}>
        Import contacts
      </Button>
      <Button asChild>
        <Link href="/clients/new">Add client</Link>
      </Button>
      {importing ? <ImportContacts onClose={() => setImporting(false)} /> : null}
    </>
  );
}
