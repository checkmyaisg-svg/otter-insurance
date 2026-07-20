import Link from 'next/link';
import { PageHeader } from '@/components/shell/PageHeader';
import { IconFileText, IconSettings, IconChevronRight, IconActivity } from '@/components/ui/icons';

/**
 * MORE — mobile overflow menu (native bottom-nav pattern). Real destinations
 * only; features that don't exist yet don't get rows.
 */
export default function MorePage() {
  const items = [
    { href: '/revenue', label: 'Revenue', desc: 'Book value, pipeline, at-risk income', Icon: IconActivity },
    { href: '/policies', label: 'Policies', desc: 'Your full book of business', Icon: IconFileText },
    { href: '/settings', label: 'Settings', desc: 'Profile and connections', Icon: IconSettings },
  ];
  return (
    <main className="mx-auto max-w-[960px] p-6 md:p-8">
      <PageHeader title="More" subtitle="" />
      <ul className="divide-y divide-white/[0.04]">
        {items.map(({ href, label, desc, Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex items-center gap-3 rounded px-2 py-3.5 transition-colors duration-150 hover:bg-muted/60"
            >
              <Icon size={18} className="shrink-0 text-faint" />
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-medium">{label}</span>
                <span className="block text-[12.5px] text-muted-foreground">{desc}</span>
              </span>
              <IconChevronRight size={16} className="shrink-0 text-faint" />
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
