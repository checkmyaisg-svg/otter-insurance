'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { deleteClientRecord } from '@/app/actions/clients';

/**
 * Delete control + confirmation dialog for a single client. Presentational
 * trigger (a "Delete" button) that opens a modal; on confirm it calls the
 * existing deleteClientRecord server action (a SOFT delete — sets deleted_at,
 * preserving history). Self-contained so the list/table stay server components.
 */
export function DeleteClientDialog({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function confirmDelete() {
    setPending(true);
    try {
      const result = await deleteClientRecord(clientId);
      if (result.ok) {
        toast(`${clientName} deleted.`, 'success');
        setOpen(false);
        router.refresh();
      } else {
        toast(result.error, 'error');
      }
    } catch {
      toast('Could not delete client. Please try again.', 'error');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        Delete
      </Button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) setOpen(false);
          }}
        >
          <div className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-lg">
            <h2 className="text-lg font-semibold">Delete client?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This removes <span className="font-medium text-foreground">{clientName}</span> from
              your active clients. Their record is archived, not permanently erased.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmDelete} disabled={pending}>
                {pending ? 'Deleting…' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
