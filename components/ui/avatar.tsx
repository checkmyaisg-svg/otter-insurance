import { cn } from '@/lib/utils';

/** Deterministic initials avatar. Same name always yields the same tint. */
export function Avatar({ name, className }: { name: string; className?: string }) {
  const parts = name.trim().split(/\s+/);
  const initials =
    parts.length === 1
      ? (parts[0]?.[0] ?? '?').toUpperCase()
      : `${parts[0]?.[0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase();

  // Deterministic hue from the name so avatars are stable and varied.
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 360;

  return (
    <span
      className={cn('flex shrink-0 items-center justify-center rounded-full text-xs font-semibold', className)}
      style={{
        backgroundColor: `hsl(${hash} 45% 92%)`,
        color: `hsl(${hash} 45% 32%)`,
      }}
      aria-hidden
    >
      {initials}
    </span>
  );
}
