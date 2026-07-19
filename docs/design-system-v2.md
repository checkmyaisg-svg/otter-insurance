# Otter Design System V2 — "Mission Control"

**Status:** Foundation spec, v2.0 · **Mode:** Dark-first · **Successor to:** the light "Premium v1" pass
**One-line philosophy:** *Calm software for people who handle other people's money.*

The advisor opens Otter and knows, in one glance, what needs them today. Everything in this
system exists to lower anxiety and raise clarity. When a decision is ambiguous, the tiebreak
order is: **information → action → everything else.**

Principles extracted from the references (not copied): Linear — speed and restraint ARE the
brand; motion never decorates, it explains. Mercury — money rendered with typographic dignity
builds trust faster than any testimonial. Attio — density is respect for a professional's
time. Vercel — monochrome + one accent = every color means something. Notion Calendar — the
chrome recedes; today is the interface. Raycast — the keyboard is a first-class citizen.
Stripe — tables are a product surface, not an afterthought.

---

## 1. Color tokens

Raw palette (locked, from the brief) → semantic tokens. Components reference ONLY semantic
tokens; raw hex never appears in component code.

### Raw
| Token | Hex | |
|---|---|---|
| `gray-950` | `#0F1117` | app background |
| `gray-900` | `#111827` | sidebar |
| `gray-850` | `#171B24` | card |
| `gray-800` | `#202633` | hover |
| `white-6` | `rgba(255,255,255,.06)` | hairline border |
| `white-10` | `rgba(255,255,255,.10)` | emphasized border / input border |
| `text-hi` | `#F5F7FA` | primary text |
| `text-mid` | `#94A3B8` | secondary text |
| `text-lo` | `#64748B` | muted text |
| `green-500` | `#22C55E` | accent |
| `green-600` | `#16A34A` | accent pressed |
| `amber-500` | `#F59E0B` | warning |
| `red-500` | `#EF4444` | danger |

### Semantic
```
--bg            gray-950     --text-primary    text-hi
--bg-sidebar    gray-900     --text-secondary  text-mid
--surface       gray-850     --text-muted      text-lo
--surface-hover gray-800     --accent          green-500
--border        white-6      --accent-active   green-600
--border-strong white-10     --warning         amber-500
--overlay       #0B0D12/80%  --danger          red-500
```

### Measured contrast (WCAG, computed against this exact palette)
| Foreground | on `--bg` | on `--surface` | Verdict |
|---|---|---|---|
| text-primary | 17.6:1 | 16.1:1 | AAA everywhere |
| text-secondary | 7.4:1 | 6.7:1 | AA all sizes ✓ |
| text-muted | **4.0:1** | **3.6:1** | **FAILS AA body** → labels/metadata ≥12px only, never sentences |
| accent green | 8.3:1 | 7.6:1 | AA ✓ incl. text |
| warning amber | 8.8:1 | 8.0:1 | AA ✓ |
| danger red | 5.0:1 | **4.6:1** | AA at 14px+ medium; below that use red for icons/dots, not words |

### Usage law
Color only when it carries meaning. Green = the one action / positive state. Amber = needs
attention soon. Red = needs attention now. Everything else is grayscale. Blue: forbidden
except link-underline hover if ever needed. Backgrounds tinted with status colors: max 6%
alpha (`red-500/6%`), and only one tinted surface per screen.

---

## 2. Typography

**Family:** Inter (variable), `font-feature-settings: "tnum" 1, "cv03" 1, "cv04" 1` on all
numeric surfaces. System stack fallback. No second typeface, ever.

| Step | Size/Line | Weight | Use |
|---|---|---|---|
| `display` | 22/28 | 600, tracking −0.015em | Page titles only |
| `heading` | 15/22 | 600 | Section titles |
| `body` | 13.5/20 | 400 | Default text |
| `body-strong` | 13.5/20 | 500 | Row primaries, emphasis |
| `small` | 12.5/18 | 400 | Secondary rows, table cells |
| `label` | 11/16 | 500, tracking +0.02em, uppercase | Field labels, column headers, eyebrows |
| `money` | 17/24 | 600, tabular | Premiums, sums — the Mercury move |

Rules: max two weights per screen region. No italics. No decorative sizes. Uppercase reserved
exclusively for `label`. Dates and all figures: tabular numerals, always.

---

## 3. Spacing & layout

**Base unit 8px; half-step 4px permitted inside components only.**
Scale: `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64`.

- Fixed sidebar **228px** desktop; content region max-width **960px** (reading) / **1200px**
  (tables), centered with 24px gutters; 12-col grid underneath for split layouts.
- Vertical rhythm: page title → 24 → first section; between sections → 32; inside cards → 16.
- Mobile: single column, 16px gutters, bottom tab bar (64px + safe-area), sticky primary
  actions above it. Touch targets ≥44px. Density relaxes ~15% on mobile (rows 48px, not 40px).

---

## 4. Radius & elevation

Radius: `4px` (inputs, buttons, badges) · `8px` (cards, dialogs, popovers) · `full` (avatars,
dots). Nothing else.

**Elevation = borders, not shadows.** Levels:
1. Canvas — `--bg`, nothing.
2. Surface — `--surface` + 1px `--border`. No shadow. (The "almost flat" card.)
3. Raised — popovers/dropdowns: `--surface` + `--border-strong` + `0 8px 24px rgba(0,0,0,.4)`.
4. Overlay — dialogs/sheets: same as raised + page dimmed with `--overlay` + 4px backdrop blur.

The only glow in the product: focus rings (`2px --accent at 40%`) and the ⌘K palette border.

---

## 5. Iconography

Lucide geometry, inline SVG set (zero deps — established in `components/ui/icons.tsx`).
Stroke **1.5px** (dark mode reads thinner strokes as more refined than 1.75). Sizes: 16px in
rows/inputs, 18px nav, 20px empty states. Color: `--text-muted` default; `--text-secondary`
on hover; status colors only when the icon IS the status. Never two icons adjacent. Never an
icon without a text label except universally understood glyphs (×, ⌄, ⌘K search).

---

## 6. Motion

**Durations:** 120ms (hover/press) · 180ms (reveal: dropdowns, sheets, rows) · 240ms (page
skeleton fade) — nothing longer. **Easing:** `cubic-bezier(0.2, 0, 0, 1)` (decelerate) for
entrances; `ease-in` 120ms for exits. **Choreography:** one thing moves at a time; lists
stagger ≤30ms/row, capped at 5 rows. **Never:** bounce, spring, scale>1.02, parallax,
attention-seeking loops. **Always:** `prefers-reduced-motion` collapses everything to
opacity 120ms. Motion explains state change; it never celebrates itself.

---

## 7. Components

**Buttons.** Heights 32px (default) / 36px (forms) / 40px (mobile primary). Radius 4.
- *Primary:* `--accent` bg, `#052E14` text (dark-on-green reads premium, 13.5/500). Hover:
  `--accent-active`. One per view, maximum.
- *Secondary:* transparent bg, `--border-strong` border, `--text-primary`. Hover: `--surface-hover`.
- *Ghost:* text-only `--text-secondary` → primary on hover. Rows and tables only.
- *Danger:* red text ghost until hover (red 8% bg); destructive dialogs get filled red.
- States: pressed = 96% brightness; disabled = 40% opacity, no cursor change games; loading =
  inline 14px spinner replacing the label, width locked (no reflow).

**Inputs.** 36px height, `--bg` fill (darker than card — fields read as "wells"), 1px
`--border-strong`, radius 4, 13.5px text. Focus: border → `--accent` + 2px 40% ring. Labels:
`label` type above, 6px gap. Errors: 1px red border + 12.5px red line below; never placeholder-
as-label. Money inputs: `S$` prefix inside the well, tabular, `inputmode=decimal`.

**Dropdowns/Select.** Native `<select>` restyled on mobile (OS picker wins for thumbs); custom
listbox on desktop: Raised elevation, 32px options, check glyph on selected, type-ahead,
180ms open.

**Cards.** Surface elevation, radius 8, padding 16. No headers-in-boxes: card title is
`heading` type sitting 8px above content, inside the card. Interactive cards: border →
`--border-strong` on hover, 120ms. No shadow-on-hover lift — hover means *border*, not levitation.

**Tables.** The product's workhorse. 40px rows (48 mobile), `label`-type column headers,
row separators `--border` (no verticals, no zebra), row hover `--surface-hover`, numeric
columns right-aligned tabular. Row = full-width click target; row actions ghost-visible on
hover with **reserved space** (the overlay bug is banned by law: *actions never occupy the
same pixels as data*). Density toggle unnecessary — we pick density for the user: compact.

**Sidebar.** `--bg-sidebar`, 228px. Wordmark 24px zone. Items: 32px, radius 4, `body-strong`
when active + 2px accent bar on the left edge (not a filled pill), icon 18px. Count badge:
number in `--text-secondary`, red only when urgent count > 0. Bottom: avatar + name + sign-out
in a quiet cluster.

**Dialogs.** Centered, 440px max, Overlay elevation, radius 8. Title `heading`, body
`body`, actions right-aligned (secondary left of primary). Entrance: fade + 4px rise, 180ms.
Destructive confirmations always restate the object: "Cancel **Wong Mei Ling's Life policy**?"
Mobile: dialogs become bottom sheets, drag handle, same content.

**Badges.** 18px height, radius 4 (NOT pills — pills died in v1 for impersonating buttons),
11px/500 text, tinted bg at 10% + colored text: `Active` green, `Pending` secondary,
`Overdue` red, `Cancelled` muted. A badge never contains an icon.

**Empty states.** One 20px icon in `--text-muted`, one `body` sentence (warm, specific), one
Secondary button. Max 200px tall. No illustrations, no dashed anything, no jokes.

**Loading.** Route level: skeletons mirroring final silhouette (`--surface` blocks, 1.5s
shimmer at 4% white), 240ms crossfade to content, zero layout shift. In-component: 14px
spinner. Never both. Never a full-page spinner.

**Command palette (⌘K).** Raised+glow, 560px, top-third of viewport. Sources: clients,
policies, actions ("Add policy", "Import contacts"), navigation. Fuzzy match, recent-first,
arrow/enter/esc. This is the Raycast organ transplant — and the single highest-craft signal
in the app. Keyboard shortcuts: `⌘K` palette · `G then T/C/P` go-to · `N` new-in-context ·
`Esc` closes anything. Shortcut hints appear in the palette, nowhere else (no tooltip spam).

**Charts (future).** Monochrome bars/lines in `--text-muted`; the datum that matters in
`--accent`. No gradients, no donuts, no legends where direct labels fit. Charts answer one
question each or they don't ship.

---

## 8. Accessibility (non-negotiables)

AA minimum per the measured table above (muted-text law enforced). Focus visible on every
interactive element (2px accent ring, 2px offset — never `outline: none` without replacement).
Full keyboard reachability incl. palette, dialogs (focus-trapped, Esc, return-focus).
Touch ≥44px. `aria-pressed`/`aria-expanded`/`role=dialog` where semantics demand. Reduced
motion honored. Status never communicated by color alone — always word or icon alongside.

---

## 9. Page application (the "then" — for approval before any implementation)

**Today = the assistant, not a dashboard.** Order: date eyebrow + greeting (display type) →
Needs Attention (the ONLY tinted surface, red 6%) → Follow Ups → Today's Schedule → Upcoming
Renewals → Recent Activity (last 5 timeline events, NEW — closes the loop on "what happened").
KPI strip: demoted to one muted inline line under the greeting; delete-able later without grief.
Every row: client (body-strong) · reason (secondary) · date (tabular) · one ghost action ·
message icon where a draft exists.

**Clients.** Table density: 40px rows — name+avatar · phone (tabular) · policies · last
activity · quiet platform dot. Search stays instant; palette becomes the power path.

**Client detail.** Identity header on canvas (no card): name display-type, metadata line in
secondary. Two surfaces only: Policies, Timeline (rail stays — it's the signature). Message
history returns in V0.4, not before.

**Policies list / Policy detail.** Table per spec; detail leads with the money block
(`money` type: **S$250.50** / monthly · **S$500,000** sum assured), then coverage facts,
then reminders as a mini-table with status badges.

**Policy form.** The 6-type grid survives (it's good) restyled: 4px radius cells, 1px border,
active = accent border + 6% tint, Lucide 20px. Sections separated by whitespace + `heading` —
zero boxes-in-boxes. Sticky mobile save with top hairline.

**Login.** Finally designed: centered 360px column on `--bg`, wordmark, two wells, one
primary button, `body` microcopy. The first four seconds finally match the rest.

---

## 10. Implementation phases (each ships behind full verification)

| Phase | Scope | Risk |
|---|---|---|
| A | Token layer + Tailwind mapping + Inter + dark `:root` flip | Low — variables only |
| B | Primitives: Button/Input/Badge/Card/Table skins | Low-med |
| C | Shell: sidebar, bottom nav, login | Med |
| D | Pages: Today → Policy form/detail → Clients → Client detail | Med |
| E | Motion + skeletons + empty states | Low |
| F | ⌘K palette + shortcuts | Med-high (new interaction surface) |

Regression gate per phase: 60-test suite, tsc, lint, build, plus a device pass for C and D.

---

*Approved tokens become law. Anything on screen that can't cite a token or a rule in this
document is a bug.*


---

## Brand — "the ripple" (added V2.1)

**Mark.** Three concentric arcs opening upper-right around a solid center dot —
an otter surfaces, the water remembers. Geometric O; motion inside stillness.
Reads at 12px because the outer arc alone still forms the O.

**Construction.** 24-unit grid; arcs r=9/6 (inner at 65% opacity), center dot
r=2.4; stroke 2; gap 65° facing 45°. Source of truth: `components/ui/OtterMark.tsx`;
app icon/favicon: `app/icon.svg` (canvas `#0F1117`, arcs accent, dot text-hi).

**Wordmark.** "Otter" — Inter 600, tracking −0.01em, sits to the RIGHT of the
mark, gap = mark/3. Never stacked, never outlined, never letterspaced-wide.

**Color.** The mark renders in exactly one color: `currentColor`. Accent green
only where it is the sole green element in view (sidebar, login); otherwise
foreground. Monochrome always works by construction.

**Clear space.** Half the mark's width on all sides. **Never:** shadows,
gradients, rotation, containers, mascots, or pairing with any illustration.

## V2.1 addendum — Operational Density

Supersedes §7-Cards/§9-Today where they conflict:
- Dashboard sections render FLAT on canvas: label-type headers (11/600 upper,
  faint; destructive-colored for the urgent section), tabular count, hairline
  row dividers at white/4%. No card wrappers. The urgent section is the
  screen's only tinted surface (destructive/6%, radius 8, no border).
- Action rows: 36px single line — tone dot (6px) · client (13.5/500) ·
  reason (13/400 muted, truncates) · date (12.5 tabular faint). Urgent rows
  alone add a red status word.
- Color budget per screen: urgent tint + tone dots + one primary button.
  Section icons: removed (they were decoration).
- Tables 36px rows; card padding 16px; detail grids gap 16px.
- Sidebar disappear-mode: no right border, no boxed search, brand mark +
  wordmark directly on the surface, icons faint→muted on hover, active =
  foreground text + accent bar only.


## V3 addendum — Prospekt / Lunar direction

Brand: **Prospekt** (supersedes Otter). Mark = "P" monogram in a 1.5px
rounded-square keyline (`components/ui/ProspektMark.tsx`), app icon at
`app/icon.svg` (dark canvas, white keyline, accent P). Wordmark rules unchanged.

Elevation law revision: cards elevate by **background separation + soft
shadow** (`0 0 0 1px white/4%, 0 2px 8px black/35%`) — decorative hairline
borders retired; structural hairlines (nav separators, sheet ring, palette)
remain. Surface radius: 12px.

New surfaces (real data, no fakery): **Calendar** (month grid + agenda over
scheduled_messages), **Messages** (All/Scheduled/Sent ledger over
scheduled_messages), **More** (mobile overflow). Mobile nav: Today · Clients ·
Messages · Calendar · More; desktop sidebar carries all six. Touch: rows ≥44px
on mobile, bottom nav ≥52px.

Excluded until the features exist: Reports, Team, Templates, Integrations,
Security/Data-Privacy settings, message threads/compose (V0.3 Cloud API).
