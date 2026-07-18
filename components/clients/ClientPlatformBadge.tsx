import { Badge } from '@/components/ui/badge';
import { formatPlatform } from '@/lib/format/display';

/** Colored badge for a client's preferred messaging platform. */
export function ClientPlatformBadge({ platform }: { platform: string }) {
  const isActive = platform === 'whatsapp'; // only whatsapp is functional in V1
  return (
    <Badge variant={isActive ? 'default' : 'outline'}>
      {formatPlatform(platform)}
      {!isActive ? ' (soon)' : ''}
    </Badge>
  );
}
