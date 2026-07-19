import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        'flex h-11 w-full rounded !border-white/10 border bg-background px-3 text-base transition-colors duration-150 placeholder:text-faint focus-visible:!border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:text-[13.5px]',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
export { Input };
