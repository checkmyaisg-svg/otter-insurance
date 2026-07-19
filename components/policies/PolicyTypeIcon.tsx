import {
  IconShield,
  IconHeartPulse,
  IconActivity,
  IconCar,
  IconHome,
  IconPlane,
  type IconProps,
} from '@/components/ui/icons';
import type { PolicyType } from '@/lib/policies/behavior';

/**
 * Policy type -> icon. UI-layer map so lib/policies/behavior.ts stays pure
 * data. Adding a policy type = one behavior-map line + one icon line here.
 */
const MAP: Record<PolicyType, (p: IconProps) => React.JSX.Element> = {
  life: IconShield,
  health: IconHeartPulse,
  ci: IconActivity,
  car: IconCar,
  home: IconHome,
  travel: IconPlane,
};

export function PolicyTypeIcon({ type, size = 18, className }: { type: PolicyType; size?: number; className?: string }) {
  const Icon = MAP[type] ?? IconShield;
  return <Icon size={size} className={className} />;
}
