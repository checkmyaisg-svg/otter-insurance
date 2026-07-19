import * as React from 'react';
import { cn } from '@/lib/utils';

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: 'default' | 'secondary' | 'outline';
};

export function Badge({ className, variant = 'secondary', ...props }: BadgeProps) {
  const variants = {
    default: 'bg-primary/10 text-primary',
    secondary: 'bg-white/[0.06] text-muted-foreground',
    outline: 'bg-faint/10 text-faint',
  };
  return (
    <span
      className={cn(
        'inline-flex h-[18px] items-center whitespace-nowrap rounded px-1.5 text-[11px] font-medium leading-none',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
