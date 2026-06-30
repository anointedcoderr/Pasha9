import {
  cloneElement,
  forwardRef,
  isValidElement,
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { Eye, EyeOff } from 'lucide-react';
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

type PasswordInputProps = Omit<InputProps, 'type' | 'rightSlot'> & {
  showLabel?: string;
  hideLabel?: string;
};

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { showLabel = 'Show password', hideLabel = 'Hide password', ...rest },
  ref,
) {
  const [revealed, setRevealed] = useState(false);
  return (
    <Input
      ref={ref}
      type={revealed ? 'text' : 'password'}
      {...rest}
      rightSlot={
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          aria-label={revealed ? hideLabel : showLabel}
          aria-pressed={revealed}
          title={revealed ? hideLabel : showLabel}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-brand-inkSoft transition hover:bg-brand-surface hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500/40"
        >
          {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      }
    />
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
  const reactId = useId();
  const errorId = `${reactId}-error`;
  const hintId = `${reactId}-hint`;
  const hasError = Boolean(error);

  // Associate the control with its error/hint text so screen readers announce
  // the validation message and expose the invalid state.
  let control = children;
  if (isValidElement(children)) {
    const child = children as ReactElement<{
      id?: string;
      invalid?: boolean;
      'aria-invalid'?: boolean | 'true' | 'false';
      'aria-describedby'?: string;
    }>;
    const controlId = child.props.id ?? reactId;
    const describedBy = hasError ? errorId : hint ? hintId : undefined;
    control = cloneElement(child, {
      id: controlId,
      invalid: hasError || child.props.invalid,
      'aria-invalid': hasError ? true : child.props['aria-invalid'],
      'aria-describedby': child.props['aria-describedby'] ?? describedBy,
    });
  }

  return (
    <label className="block w-full">
      {label ? (
        <span className="mb-2 flex items-center gap-1 text-sm text-ink-mid">
          {label}
          {required ? <span className="text-gold-300">*</span> : null}
        </span>
      ) : null}
      {control}
      {error ? (
        <span id={errorId} role="alert" className="mt-1.5 block text-xs text-signal-danger">
          {error}
        </span>
      ) : hint ? (
        <span id={hintId} className="mt-1.5 block text-xs text-ink-lo">
          {hint}
        </span>
      ) : null}
    </label>
  );
}
