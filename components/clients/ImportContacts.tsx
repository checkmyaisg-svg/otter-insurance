'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { parseContacts } from '@/lib/import/parse';
import { categorizeContacts, type CategorizedImport } from '@/lib/import/pipeline';
import { getExistingPhones, importClients, type ImportSummary } from '@/app/actions/import';

type Step = 'upload' | 'parsing' | 'preview' | 'importing' | 'summary';

/**
 * Import Contacts — a modern multi-step onboarding flow:
 *   upload (drag-drop) → parse + categorize → preview (choose) → import → summary
 * All parsing/categorization happens in the browser (fast, private — the file
 * never needs uploading anywhere); only the chosen valid rows are sent to the
 * bulk-insert action. Reuses the shared normalizer + Clients table.
 */
export function ImportContacts({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>('upload');
  const [fileName, setFileName] = React.useState('');
  const [result, setResult] = React.useState<CategorizedImport | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [summary, setSummary] = React.useState<ImportSummary | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setFileName(file.name);
    setStep('parsing');
    try {
      const text = await file.text();
      const parsed = parseContacts(file.name, text);
      if (parsed.length === 0) {
        setError('No contacts found in that file. Check it has name and phone columns.');
        setStep('upload');
        return;
      }
      const existing = await getExistingPhones();
      const categorized = categorizeContacts(parsed, new Set(existing));
      setResult(categorized);
      // Pre-select all valid contacts.
      setSelected(new Set(categorized.contacts.filter((c) => c.category === 'valid').map((c) => c.key)));
      setStep('preview');
    } catch {
      setError('Could not read that file. Supported formats: CSV and VCF.');
      setStep('upload');
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function runImport() {
    if (!result) return;
    const chosen = result.contacts.filter((c) => selected.has(c.key) && c.category === 'valid');
    if (chosen.length === 0) {
      setError('Select at least one contact to import.');
      return;
    }
    setError(null);
    setStep('importing');
    const res = await importClients({
      contacts: chosen.map((c) => ({ full_name: c.full_name, phone: c.phone, email: c.email ?? '' })),
    });
    if (res.ok) {
      setSummary(res.data);
      setStep('summary');
      router.refresh();
    } else {
      setError(res.error);
      setStep('preview');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border bg-card shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-base font-semibold">Import contacts</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {error ? (
            <p role="alert" className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {step === 'upload' ? (
            <div>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition-colors ${dragOver ? 'border-primary bg-accent' : 'border-border'}`}
              >
                <div className="text-3xl" aria-hidden>📇</div>
                <p className="mt-3 text-sm font-medium">Drag a file here, or choose one</p>
                <p className="mt-1 text-xs text-muted-foreground">CSV or VCF (vCard) — exported from your phone or email</p>
                <label className="mt-4">
                  <span className="inline-flex h-10 cursor-pointer items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90">
                    Choose file
                  </span>
                  <input
                    type="file"
                    accept=".csv,.vcf,text/csv,text/vcard"
                    className="sr-only"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                  />
                </label>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Your file is read in your browser — contacts are only saved once you confirm the import.
              </p>
            </div>
          ) : null}

          {step === 'parsing' || step === 'importing' ? (
            <div className="flex flex-col items-center justify-center py-14">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
              <p className="mt-4 text-sm text-muted-foreground">
                {step === 'parsing' ? `Reading ${fileName}…` : 'Importing contacts…'}
              </p>
            </div>
          ) : null}

          {step === 'preview' && result ? (
            <PreviewList result={result} selected={selected} toggle={toggle} setSelected={setSelected} />
          ) : null}

          {step === 'summary' && summary ? (
            <ImportSummaryView summary={summary} result={result} />
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t px-6 py-4">
          {step === 'preview' && result ? (
            <>
              <p className="text-sm text-muted-foreground">
                {selected.size} of {result.counts.valid} selected
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                <Button onClick={runImport} disabled={selected.size === 0}>
                  Import {selected.size} {selected.size === 1 ? 'contact' : 'contacts'}
                </Button>
              </div>
            </>
          ) : null}
          {step === 'summary' ? (
            <div className="ml-auto">
              <Button onClick={onClose}>Done</Button>
            </div>
          ) : null}
          {step === 'upload' ? (
            <div className="ml-auto">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CountPill({ label, value, tone }: { label: string; value: number; tone: 'valid' | 'duplicate' | 'invalid' }) {
  const styles = {
    valid: 'bg-primary/10 text-primary',
    duplicate: 'bg-amber-100 text-amber-700',
    invalid: 'bg-destructive/10 text-destructive',
  }[tone];
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${styles}`}>
      {value} {label}
    </span>
  );
}

function PreviewList({
  result,
  selected,
  toggle,
  setSelected,
}: {
  result: CategorizedImport;
  selected: Set<string>;
  toggle: (key: string) => void;
  setSelected: (s: Set<string>) => void;
}) {
  const validContacts = result.contacts.filter((c) => c.category === 'valid');
  const others = result.contacts.filter((c) => c.category !== 'valid');
  const allSelected = validContacts.length > 0 && validContacts.every((c) => selected.has(c.key));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <CountPill label="ready" value={result.counts.valid} tone="valid" />
        <CountPill label="duplicates" value={result.counts.duplicate} tone="duplicate" />
        <CountPill label="invalid" value={result.counts.invalid} tone="invalid" />
        <span className="ml-auto text-xs text-muted-foreground">{result.counts.total} found</span>
      </div>

      {validContacts.length > 0 ? (
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">To import</span>
          <button
            className="text-xs font-medium text-primary hover:underline"
            onClick={() => setSelected(allSelected ? new Set() : new Set(validContacts.map((c) => c.key)))}
          >
            {allSelected ? 'Deselect all' : 'Select all'}
          </button>
        </div>
      ) : null}

      <ul className="divide-y rounded-lg border">
        {validContacts.map((c) => (
          <li key={c.key} className="flex items-center gap-3 px-3 py-2.5">
            <input
              type="checkbox"
              checked={selected.has(c.key)}
              onChange={() => toggle(c.key)}
              className="h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{c.full_name}</p>
              <p className="truncate text-xs text-muted-foreground tabular-nums">{c.phone}</p>
            </div>
          </li>
        ))}
      </ul>

      {others.length > 0 ? (
        <div className="mt-5">
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Skipped
          </p>
          <ul className="divide-y rounded-lg border bg-muted/30">
            {others.map((c) => (
              <li key={c.key} className="flex items-center gap-3 px-3 py-2.5 opacity-70">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{c.full_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.phone || '—'}</p>
                </div>
                <span className={`shrink-0 text-xs ${c.category === 'duplicate' ? 'text-amber-600' : 'text-destructive'}`}>
                  {c.reason}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ImportSummaryView({ summary, result }: { summary: ImportSummary; result: CategorizedImport | null }) {
  const found = result?.counts.total ?? summary.imported + summary.skipped;
  const invalid = result?.counts.invalid ?? 0;
  return (
    <div className="py-6 text-center">
      <div className="text-4xl" aria-hidden>🎉</div>
      <h3 className="mt-3 text-lg font-semibold">Import complete</h3>
      <p className="mt-1 text-sm text-muted-foreground">Your clients are ready.</p>

      <dl className="mx-auto mt-6 grid max-w-sm grid-cols-2 gap-3 text-left">
        <Stat label="Contacts found" value={found} />
        <Stat label="Imported" value={summary.imported} tone="primary" />
        <Stat label="Duplicates skipped" value={summary.skipped} />
        <Stat label="Invalid" value={invalid} />
      </dl>
      {summary.failed > 0 ? (
        <p className="mt-4 text-xs text-destructive">{summary.failed} could not be saved and were skipped.</p>
      ) : null}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'primary' }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <div className={`text-xl font-semibold tabular-nums ${tone === 'primary' ? 'text-primary' : ''}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
