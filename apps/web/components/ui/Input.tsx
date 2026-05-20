import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: ReactNode;
  rightSlot?: ReactNode;
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, leftIcon, rightSlot, invalid, ...rest },
  ref,
) {
  return (
    <div className="relative flex items-center">
      {leftIcon ? <span className="pointer-events-none absolute left-3 text-ink-lo">{leftIcon}</span> : null}
      <input
        ref={ref}
        className={cn(
          'input-base',
          leftIcon && 'pl-10',
          rightSlot && 'pr-12',
          invalid && 'border-signal-danger/60 focus:border-signal-danger',
          className,
        )}
        {...rest}
      />
      {rightSlot ? <span className="absolute right-2">{rightSlot}</span> : null}
    </div>
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, rows = 4, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn('input-base resize-none', invalid && 'border-signal-danger/60', className)}
      {...rest}
    />
  );
});

export function FormField({
  label,
  hint,
  error,
  required,
  children,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block w-full">
      {label ? (
        <span className="mb-2 flex items-center gap-1 text-sm text-ink-mid">
          {label}
          {required ? <span className="text-gold-300">*</span> : null}
        </span>
      ) : null}
      {children}
      {error ? <span className="mt-1.5 block text-xs text-signal-danger">{error}</span> : hint ? <span className="mt-1.5 block text-xs text-ink-lo">{hint}</span> : null}
    </label>
  );
}
