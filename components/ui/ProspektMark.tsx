/**
 * PROSPEKT BRAND MARK — "P" monogram in a rounded square (brand v3, Lunar direction).
 * Geometric P (stem + bowl) inside a 1.5px rounded-square keyline. One color:
 * currentColor. Favicon-safe: the keyline + bowl read at 12px.
 * Wordmark: "Prospekt", Inter 600, tracking -0.01em, right of mark, gap = mark/3.
 */
export function ProspektMark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="1.5" y="1.5" width="21" height="21" rx="6" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M9.2 17.5V6.5h4.1a3.6 3.6 0 0 1 0 7.2H9.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
