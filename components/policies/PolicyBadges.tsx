import { Badge } from '@/components/ui/badge';
import { POLICY_TYPE_LABEL } from '@/lib/policies/behavior';
import type { PolicyType } from '@/lib/policies/behavior';

/** Badge for any policy type — labels come from the behavior map. */
export function PolicyTypeBadge({ type }: { type: string }) {
  return <Badge variant="secondary">{POLICY_TYPE_LABEL[type as PolicyType] ?? type}</Badge>;
}

/** Colored badge for policy status. */
export function PolicyStatusBadge({ status }: { status: string }) {
  const variant =
    status === 'active' ? 'default' : status === 'cancelled' ? 'outline' : 'secondary';
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return <Badge variant={variant}>{label}</Badge>;
}
