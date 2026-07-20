'use client';

import * as React from 'react';
import Link from 'next/link';
import { buildWaUrl, waPhoneFromE164 } from '@/lib/whatsapp/link';
import { logWhatsAppDraftOpened } from '@/app/actions/whatsapp';
import { IconMessageCircle, IconX } from '@/components/ui/icons';

/**
 * WhatsApp draft flow: 💬 button -> preview sheet -> "Open WhatsApp".
 *
 * Mobile-first: the preview renders as a bottom sheet with a large editable
 * textarea (the advisor can tweak wording before opening WhatsApp), a single
 * primary action, and 44px+ targets. The wa.me link opens the WhatsApp app the
 * advisor already uses — personal or Business — with recipient and message
 * prefilled; the advisor reviews and taps Send inside WhatsApp itself.
 *
 * Missing phone: the button still opens the sheet, which explains the problem
 * and links to the client record — never a dead or broken link.
 *
 * Logging is fire-and-forget on open: a failure to log NEVER blocks messaging.
 */
export function MessageDraft({
  clientId,
  clientName,
  policyId,
  phone,
  message,
  compact,
}: {
  clientId: string;
  clientName: string;
  policyId?: string | null;
  phone: string | null;
  message: string;
  /** compact = icon-only button (dashboard rows); full = labeled button */
  compact?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState(message);
  const waPhone = waPhoneFromE164(phone);

  // Re-sync if the server-provided draft changes (e.g. after a refresh).
  React.useEffect(() => setText(message), [message]);

  // A11y: Esc closes the sheet while open.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const openWhatsApp = () => {
    // Fire-and-forget log; never block the advisor's flow on it.
    void logWhatsAppDraftOpened({ clientId, policyId, body: text }).catch(() => {});
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Message ${clientName} on WhatsApp`}
        className={
          compact
            ? 'flex h-11 w-11 shrink-0 items-center justify-center rounded transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40'
            : 'inline-flex h-11 items-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-accent'
        }
      >
        <IconMessageCircle size={18} className="text-primary" />
        {compact ? null : <span>Message</span>}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label={`WhatsApp message to ${clientName}`}
          onClick={() => setOpen(false)}
        >
          <div
            className="ds-enter w-full max-w-lg rounded-t-2xl bg-card p-4 shadow-xl ring-1 ring-black/5 sm:rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">Message {clientName}</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
              >
                <IconX size={16} />
              </button>
            </div>

            {waPhone ? (
              <>
                <textarea
                  autoFocus
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  rows={6}
                  className="w-full resize-none rounded-md border border-input bg-background p-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"
                  aria-label="Message text"
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Review and edit if you like — WhatsApp will open with this message ready to send.
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <a
                    href={buildWaUrl(waPhone, text)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={openWhatsApp}
                    className="flex h-11 flex-1 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Open WhatsApp
                  </a>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="h-11 rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <div className="rounded-md bg-muted/60 p-5 text-center">
                <p className="text-sm font-medium">No valid phone number for {clientName}.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add a mobile number to message them on WhatsApp.
                </p>
                <Link
                  href={`/clients/${clientId}/edit`}
                  className="mt-3 inline-flex h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Edit client
                </Link>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
