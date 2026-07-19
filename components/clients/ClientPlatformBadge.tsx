/**
 * Preferred-platform indicator. Deliberately NOT pill/button-shaped: a status
 * dot + quiet text. (Design rule: pills = status badges only; anything
 * button-shaped must be pressable. This used to look like a green button.)
 */
const DOT: Record<string, string> = {
  whatsapp: 'bg-primary',
  wechat: 'bg-emerald-500',
  telegram: 'bg-sky-500',
};
const LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp',
  wechat: 'WeChat',
  telegram: 'Telegram',
};

export function ClientPlatformBadge({ platform }: { platform: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[platform] ?? 'bg-muted-foreground'}`} aria-hidden />
      {LABEL[platform] ?? platform}
    </span>
  );
}
