// Built by Anointed Coder.
//
// A number field an operator can actually edit.
//
// The naive pattern, value={someNumber} with onChange={Number(e.target.value)},
// has two defects the client hit on real phones:
//
//   1. Clearing the field parses '' to 0, so the 0 snaps straight back and a
//      value can never be deleted before typing a new one.
//   2. iOS keeps the text the user typed when React writes back an equivalent
//      number, so typing after a 0 shows "020" while the state says 20, and
//      the operator cannot tell what will actually save.
//
// The cure is owning the TEXT while the field is focused. The draft string is
// what renders, so '' stays empty and "020" stays visible; the parent is only
// told about values that parse, so previews keep updating live; and blur
// normalises the draft back to the committed number, so "020" becomes "20"
// the moment the operator leaves the field.
//
// Everything except value/onChange passes straight through to Input. That is
// load-bearing, not convenience: FormField clones its child to inject id,
// invalid and the aria wiring for its label, hint and error text, and a props
// type that does not forward them would silently strip the accessibility off
// every field this component replaces.

'use client';

import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { Input } from '@/components/ui/Input';

type InputProps = ComponentProps<typeof Input>;

interface Props extends Omit<InputProps, 'value' | 'onChange' | 'type' | 'defaultValue'> {
  /** Committed value from the parent. */
  value: number;
  /** Called only when the draft parses to a finite number within min/max. */
  onValueChange: (n: number) => void;
}

export function NumericInput({ value, onValueChange, onFocus, onBlur, ...rest }: Props) {
  const [draft, setDraft] = useState<string>(String(value));
  const focused = useRef(false);

  const min = rest.min !== undefined ? Number(rest.min) : undefined;
  const max = rest.max !== undefined ? Number(rest.max) : undefined;

  // Follow external changes (load from the server, a save response) but never
  // while the operator is typing, which is exactly when overwriting the text
  // causes the bugs this component exists to fix.
  useEffect(() => {
    if (!focused.current) setDraft(String(value));
  }, [value]);

  const commit = (raw: string) => {
    setDraft(raw);
    if (raw.trim() === '') return; // cleared: keep the parent's last value
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    if (min !== undefined && n < min) return;
    if (max !== undefined && n > max) return;
    onValueChange(n);
  };

  return (
    <Input
      {...rest}
      type="number"
      inputMode={rest.inputMode ?? 'decimal'}
      value={draft}
      onChange={(e) => commit(e.target.value)}
      onFocus={(e) => {
        focused.current = true;
        onFocus?.(e);
      }}
      onBlur={(e) => {
        focused.current = false;
        // Whatever the text looked like, the committed number is the truth.
        setDraft(String(value));
        onBlur?.(e);
      }}
    />
  );
}
