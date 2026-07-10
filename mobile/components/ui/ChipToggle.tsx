// Built by Anointed Coder.
//
// ChipToggle: a single-select row of pill chips (a segmented control). The
// active chip gets a gold fill. Used for filters and tab-like switches
// (All / Slots / Live / Crash, Deposit / Withdraw, etc.).
//
// Props:
//   options   ChipOption[]        { key, label } chips (required)
//   value     string              currently selected key (required)
//   onChange  (key) => void       selection handler (required)
//   scroll    boolean             horizontal scroll when many chips
//   className string

import { Pressable, ScrollView, Text, View } from 'react-native';
import { cn } from '@/lib/cn';

export interface ChipOption {
  key: string;
  label: string;
}

export interface ChipToggleProps {
  options: ChipOption[];
  value: string;
  onChange: (key: string) => void;
  scroll?: boolean;
  className?: string;
}

export function ChipToggle({ options, value, onChange, scroll = false, className }: ChipToggleProps) {
  const chips = options.map((opt) => {
    const active = opt.key === value;
    return (
      <Pressable
        key={opt.key}
        onPress={() => onChange(opt.key)}
        className={cn(
          'rounded-pill border px-3.5 py-2 active:opacity-80',
          active ? 'border-gold-600 bg-gold-500' : 'border-divider bg-paper',
        )}
      >
        <Text className={cn('text-xs font-bold', active ? 'text-ink' : 'text-ink-soft')}>
          {opt.label}
        </Text>
      </Pressable>
    );
  });

  if (scroll) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
        className={cn('', className)}
      >
        {chips}
      </ScrollView>
    );
  }

  return <View className={cn('flex-row flex-wrap gap-2', className)}>{chips}</View>;
}
