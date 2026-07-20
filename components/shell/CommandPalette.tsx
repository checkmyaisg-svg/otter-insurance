'use client';

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { paletteSearch, type PaletteResult } from '@/app/actions/palette';

/**
 * ⌘K COMMAND PALETTE — DS V2 §7. The Raycast organ transplant.
 *
 * Shortcuts (registered globally, ignored while typing in fields):
 *   ⌘K / Ctrl+K  open palette
 *   G then T/C/P/S  go to Today / Clients / Policies / Settings
 *   N  new-in-context (clients -> new client, policies -> new policy)
 *   Esc  close
 *
 * Sources: navigation + quick actions (static, instant) and clients/policies
 * (server search, debounced 150ms). Keyboard: ↑↓ move, Enter opens, hints
 * shown inline — the only place shortcut hints appear in the product.
 */

interface StaticItem {
  id: string;
  group: 'Navigate' | 'Actions';
  title: string;
  subtitle: string;
  href: string;
  keywords: string;
}

const STATIC_ITEMS: StaticItem[] = [
  { id: 'nav-today', group: 'Navigate', title: 'Today', subtitle: 'G T', href: '/', keywords: 'today dashboard home' },
  { id: 'nav-revenue', group: 'Navigate', title: 'Revenue', subtitle: '', href: '/revenue', keywords: 'revenue income pipeline money book' },
  { id: 'nav-clients', group: 'Navigate', title: 'Clients', subtitle: 'G C', href: '/clients', keywords: 'clients people directory' },
  { id: 'nav-policies', group: 'Navigate', title: 'Policies', subtitle: 'G P', href: '/policies', keywords: 'policies book' },
  { id: 'nav-settings', group: 'Navigate', title: 'Settings', subtitle: 'G S', href: '/settings', keywords: 'settings profile account' },
  { id: 'act-new-client', group: 'Actions', title: 'Add client', subtitle: '', href: '/clients/new', keywords: 'new add client create' },
  { id: 'act-new-policy', group: 'Actions', title: 'Add policy', subtitle: '', href: '/policies/new', keywords: 'new add policy create' },
  { id: 'act-import', group: 'Actions', title: 'Import contacts', subtitle: '', href: '/clients?import=1', keywords: 'import contacts csv vcf upload' },
];

type Item = (StaticItem | PaletteResult) & { group: string };

export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [remote, setRemote] = React.useState<PaletteResult[]>([]);
  const [active, setActive] = React.useState(0);
  const [pendingG, setPendingG] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const isTypingContext = (el: EventTarget | null) => {
    const t = el as HTMLElement | null;
    if (!t) return false;
    const tag = t.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
  };

  // Global shortcuts
  React.useEffect(() => {
    let gTimer: ReturnType<typeof setTimeout> | null = null;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (open || isTypingContext(e.target)) return;
      if (pendingG) {
        const map: Record<string, string> = { t: '/', c: '/clients', p: '/policies', s: '/settings' };
        const dest = map[e.key.toLowerCase()];
        if (dest) {
          e.preventDefault();
          router.push(dest);
        }
        setPendingG(false);
        return;
      }
      if (e.key.toLowerCase() === 'g') {
        setPendingG(true);
        gTimer = setTimeout(() => setPendingG(false), 800);
        return;
      }
      if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        router.push(pathname.startsWith('/clients') ? '/clients/new' : '/policies/new');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (gTimer) clearTimeout(gTimer);
    };
  }, [open, pendingG, router, pathname]);

  // Open/close lifecycle
  React.useEffect(() => {
    if (open) {
      setQuery('');
      setRemote([]);
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Debounced server search
  React.useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setRemote([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      void paletteSearch(query).then(setRemote).catch(() => {});
    }, 150);
  }, [query, open]);

  const q = query.trim().toLowerCase();
  const staticMatches = STATIC_ITEMS.filter(
    (i) => !q || i.title.toLowerCase().includes(q) || i.keywords.includes(q),
  );
  const items: Item[] = [...staticMatches, ...remote];

  React.useEffect(() => setActive(0), [query, remote.length]);

  const go = (item: Item) => {
    setOpen(false);
    router.push(item.href);
  };

  if (!open) return null;

  let lastGroup = '';
  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 pt-[18vh] backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onClick={() => setOpen(false)}
    >
      <div
        className="ds-enter w-full max-w-[560px] overflow-hidden rounded-lg border !border-white/10 bg-card shadow-[0_8px_24px_rgba(0,0,0,.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, items.length - 1));
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            }
            if (e.key === 'Enter' && items[active]) go(items[active]);
          }}
          placeholder="Search clients, policies, actions…"
          className="h-12 w-full border-b !border-white/[0.06] bg-transparent px-4 text-[14px] text-foreground placeholder:text-faint focus:outline-none"
          aria-label="Search"
        />
        <ul className="max-h-[320px] overflow-y-auto py-1.5" role="listbox">
          {items.length === 0 ? (
            <li className="px-4 py-6 text-center text-[13.5px] text-muted-foreground">
              {q.length >= 2 ? 'No matches.' : 'Type to search your book.'}
            </li>
          ) : (
            items.map((item, i) => {
              const header = item.group !== lastGroup ? item.group : null;
              lastGroup = item.group;
              return (
                <React.Fragment key={item.id}>
                  {header ? (
                    <li className="px-4 pb-1 pt-2.5 text-[11px] font-medium uppercase tracking-wide text-faint">
                      {header}
                    </li>
                  ) : null}
                  <li
                    role="option"
                    aria-selected={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(item)}
                    className={`mx-1.5 flex h-8 cursor-pointer items-center justify-between rounded px-2.5 text-[13.5px] transition-colors duration-150 ${
                      i === active ? 'bg-muted text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    <span className="truncate">{item.title}</span>
                    <span className="ml-3 shrink-0 text-[11px] tabular-nums text-faint">{item.subtitle}</span>
                  </li>
                </React.Fragment>
              );
            })
          )}
        </ul>
        <div className="flex items-center gap-3 border-t !border-white/[0.06] px-4 py-2 text-[11px] text-faint">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
          <span className="ml-auto">G then T/C/P/S · N new</span>
        </div>
      </div>
    </div>
  );
}
