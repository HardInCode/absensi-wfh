import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type = 'text', ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      'h-10 w-full rounded-md border border-edge bg-card px-3 text-sm text-ink placeholder:text-muted disabled:cursor-not-allowed disabled:bg-canvas disabled:opacity-60 aria-[invalid=true]:border-danger',
      className,
    )}
    {...props}
  />
));
Input.displayName = 'Input';

