import { Badge } from '@/components/ui/badge';

const TYPE_LABEL: Record<string, string> = {
  travel: 'Travel',
  car: 'Car',
  home: 'Home',
};

/** Badge for a policy type (travel/car/home). */
export function PolicyTypeBadge({ type }: { type: string }) {
  return <Badge variant="secondary">{TYPE_LABEL[type] ?? type}</Badge>;
}

/** Colored badge for policy status. */
export function PolicyStatusBadge({ status }: { status: string }) {
  const variant =
    status === 'active' ? 'default' : status === 'cancelled' ? 'outline' : 'secondary';
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return <Badge variant={variant}>{label}</Badge>;
}
