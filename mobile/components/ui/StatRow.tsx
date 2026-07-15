// Built by Anointed Coder.
//
// StatRow: an evenly-split row of stat cells (value on top, label below,
// optional icon). Used for wallet summaries, referral stats, VIP progress,
// etc. Cells are divided by hairlines.
//
// Props:
//   items      StatItem[]  the cells (required)
//   tone       'light' | 'dark'  surface adaptation (default 'light')
//   className  string
//
// Example:
//   <StatRow items={[
//     { label: 'Referred', value: '24' },
//     { label: 'Active', value: '11', valueTone: 'green' },
//     { label: 'Earned', value: 'BDT 8,600', valueTone: 'gold' },
//   ]} />

import { Text, View } from 'react-native';
import { Icon } from './Icon';
import { colors } from '@/lib/theme';
import { cn } from '@/lib/cn';

type IconName = string;
type ValueTone = 'ink' | 'gold' | 'green' | 'blue';

export interface StatItem {
  label: string;
  value: string;
  icon?: IconName;
  valueTone?: ValueTone;
}

export interface StatRowProps {
  items: StatItem[];
  tone?: 'light' | 'dark';
  className?: string;
}

const VALUE_COLOR: Record<ValueTone, string> = {
  ink: colors.ink,
  gold: colors.gold700,
  green: colors.newg,
  blue: colors.blue600,
};

export function StatRow({ items, tone = 'light', className }: StatRowProps) {
  const dark = tone === 'dark';
  return (
    <View
      className={cn(
        'flex-row items-stretch rounded-2xl border',
        dark ? 'border-white/10 bg-darkbg' : 'border-divider bg-paper',
        className,
      )}
    >
      {items.map((item, i) => (
        <View
          key={item.label}
          className={cn(
            'flex-1 items-center px-2 py-3',
            i > 0 && (dark ? 'border-l border-white/10' : 'border-l border-divider'),
          )}
        >
          {item.icon ? (
            <View style={{ marginBottom: 2 }}>
              <Icon name={item.icon} size={16} color={dark ? colors.gold300 : colors.gold600} />
            </View>
          ) : null}
          <Text
            className="text-base font-black"
            style={{ color: dark ? colors.dinkHi : VALUE_COLOR[item.valueTone ?? 'ink'] }}
            numberOfLines={1}
          >
            {item.value}
          </Text>
          <Text
            className={cn('mt-0.5 text-[11px] font-medium', dark ? 'text-white/55' : 'text-ink-mute')}
            numberOfLines={1}
          >
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
