'use client';

import * as React from 'react';
import Link from 'next/link';
import { askCopilot, type CopilotResponse } from '@/app/actions/copilot';
import { MessageDraft } from '@/components/whatsapp/MessageDraft';
import { IconMessageCircle, IconX, IconChevronRight } from '@/components/ui/icons';

/**
 * PROSPEKT COPILOT — the intelligence interface.
 * Floating entry on every screen; bottom sheet on mobile, right panel on
 * desktop. Deterministic orchestration over the engines (see
 * app/actions/copilot.ts) — fast, offline-honest, zero hallucination.
 * Every answer: direct answer → reasoning → recommendation → one-click actions.
 */

interface Turn {
  role: 'user' | 'copilot';
  text?: string;
  response?: CopilotResponse;
}

const SUGGESTIONS = [
  'Who should I call today?',
  'Which renewals are at risk?',
  'Birthdays this week?',
  "Who haven't I spoken to in 90 days?",
  'How much revenue is at risk?',
];

export function Copilot() {
  const [open, setOpen] = React.useState(false);
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [input, setInput] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const listRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);
  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [turns, busy]);
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const ask = async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    setInput('');
    setTurns((t) => [...t, { role: 'user', text: question }]);
    setBusy(true);
    try {
      const response = await askCopilot(question);
      setTurns((t) => [...t, { role: 'copilot', response }]);
    } catch {
      setTurns((t) => [...t, { role: 'copilot', response: { answer: 'Something went wrong — try again.', reasoning: [], recommendation: null, items: [], draft: null } }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Floating entry — above bottom nav on mobile, corner on desktop */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open Prospekt Copilot"
        className="fixed bottom-20 right-4 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_4px_16px_rgba(0,0,0,0.45)] transition-transform duration-150 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background md:bottom-6 md:right-6"
      >
        <IconMessageCircle size={20} />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-[2px] md:items-stretch md:justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="Prospekt Copilot"
          onClick={() => setOpen(false)}
        >
          <div
            className="ds-enter flex h-[85vh] w-full flex-col rounded-t-2xl bg-card shadow-[0_0_0_1px_rgba(255,255,255,0.06)] md:h-full md:w-[400px] md:rounded-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b !border-white/[0.06] px-4 py-3">
              <p className="flex items-center gap-2 text-[13.5px] font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                Prospekt Copilot
              </p>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
                <IconX size={16} />
              </button>
            </div>

            <div ref={listRef} aria-live="polite" className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {turns.length === 0 ? (
                <div className="mt-2">
                  <p className="text-[13.5px] text-muted-foreground">
                    Ask about your book — I answer from Prospekt&apos;s intelligence engines.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {SUGGESTIONS.map((sugg) => (
                      <button
                        key={sugg}
                        type="button"
                        onClick={() => void ask(sugg)}
                        className="flex h-8 items-center rounded bg-muted px-2.5 text-[12.5px] text-muted-foreground transition-colors duration-150 hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                      >
                        {sugg}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="space-y-4">
                {turns.map((t, i) =>
                  t.role === 'user' ? (
                    <p key={i} className="ml-auto max-w-[85%] rounded-lg bg-primary/10 px-3 py-2 text-[13.5px] text-foreground">
                      {t.text}
                    </p>
                  ) : (
                    <div key={i} className="max-w-full">
                      <p className="text-[13.5px] font-medium leading-5">{t.response!.answer}</p>
                      {t.response!.reasoning.length > 0 ? (
                        <ul className="mt-1 space-y-0.5">
                          {t.response!.reasoning.map((rsn, j) => (
                            <li key={j} className="text-[12.5px] leading-4 text-muted-foreground">· {rsn}</li>
                          ))}
                        </ul>
                      ) : null}
                      {t.response!.items.length > 0 ? (
                        <ul className="mt-2 divide-y divide-white/[0.04]">
                          {t.response!.items.map((item, j) => (
                            <li key={j}>
                              <Link
                                href={item.href}
                                onClick={() => setOpen(false)}
                                className="group flex h-9 items-center gap-2 rounded px-1.5 transition-colors duration-150 hover:bg-muted/60"
                              >
                                <span className="shrink-0 truncate text-[13px] font-medium group-hover:text-primary">{item.title}</span>
                                <span className="min-w-0 flex-1 truncate text-[12.5px] text-muted-foreground">{item.subtitle}</span>
                                {item.value ? <span className="shrink-0 text-[12.5px] font-medium tabular-nums">{item.value}</span> : null}
                                <IconChevronRight size={14} className="shrink-0 text-faint" />
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {t.response!.recommendation ? (
                        <p className="mt-2 rounded bg-primary/[0.07] px-2.5 py-1.5 text-[12.5px] leading-4 text-foreground">
                          {t.response!.recommendation}
                        </p>
                      ) : null}
                      {t.response!.draft && t.response!.draft.phone ? (
                        <div className="mt-2 flex items-center gap-1 text-[12.5px] text-muted-foreground">
                          <span className="truncate">Draft ready for {t.response!.draft.clientName}</span>
                          <MessageDraft
                            clientId={t.response!.draft.clientId}
                            clientName={t.response!.draft.clientName}
                            policyId={t.response!.draft.policyId}
                            phone={t.response!.draft.phone}
                            message={t.response!.draft.message}
                            compact
                          />
                        </div>
                      ) : null}
                    </div>
                  ),
                )}
                {busy ? <p className="text-[12.5px] text-faint">Thinking…</p> : null}
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void ask(input);
              }}
              className="border-t !border-white/[0.06] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your book…"
                className="h-10 w-full rounded border !border-white/10 bg-background px-3 text-[13.5px] placeholder:text-faint focus-visible:!border-primary focus-visible:outline-none"
                aria-label="Ask Prospekt Copilot"
              />
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
