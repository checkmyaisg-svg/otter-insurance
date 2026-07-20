'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { logInteraction } from '@/app/actions/interactions';
import { Button } from '@/components/ui/button';

/**
 * QUICK LOG — one-tap ground-truth capture: "I called / met / messaged this
 * client." Lives on the client profile; three taps max. Keeping this friction
 * near zero is the whole feature — if logging feels like admin, it dies.
 */
const TYPES: { key: 'call' | 'meeting' | 'whatsapp' | 'email' | 'note'; label: string }[] = [
  { key: 'call', label: 'Call' },
  { key: 'meeting', label: 'Meeting' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'email', label: 'Email' },
  { key: 'note', label: 'Note' },
];

export function QuickLog({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [type, setType] = React.useState<(typeof TYPES)[number]['key'] | null>(null);
  const [note, setNote] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const submit = async () => {
    if (!type) return;
    setPending(true);
    setErr(null);
    const res = await logInteraction({ client_id: clientId, interaction_type: type, note: note.trim() || null });
    setPending(false);
    if (res.ok) {
      setType(null);
      setNote('');
      router.refresh();
    } else {
      setErr(res.error || 'Couldn\u2019t save that — please try again.');
    }
  };

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[12.5px] text-faint">Log contact:</span>
        {TYPES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setType(type === t.key ? null : t.key)}
            className={`flex h-7 items-center rounded px-2 text-[12.5px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
              type === t.key ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground hover:bg-muted'
            }`}
            aria-pressed={type === t.key}
          >
            {t.label}
          </button>
        ))}
      </div>
      {type ? (
        <div className="ds-enter mt-2 flex items-center gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="What was it about? (optional)"
            maxLength={1000}
            autoFocus
            className="h-9 min-w-0 flex-1 rounded border !border-white/10 bg-background px-3 text-[13.5px] placeholder:text-faint focus-visible:!border-primary focus-visible:outline-none"
          />
          <Button size="sm" onClick={submit} disabled={pending}>
            {pending ? 'Saving…' : `Log ${TYPES.find((t) => t.key === type)?.label.toLowerCase()}`}
          </Button>
        </div>
      ) : null}
      {err ? <p className="mt-1.5 text-[12.5px] text-destructive">{err}</p> : null}
    </div>
  );
}
