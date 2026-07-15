// Built by Anointed Coder.
//
// TextField: a labeled text input with an optional leading icon, helper /
// error text, and focus styling. Wraps RN TextInput.
//
// Props (extends the common TextInput props via `inputProps`):
//   label         string      field label above the input
//   value         string
//   onChangeText  (t) => void
//   placeholder   string
//   icon          Ionicons name  leading icon
//   error         string      red helper line under the field
//   helper        string      neutral helper line (ignored when error set)
//   secureTextEntry / keyboardType / autoCapitalize  standard input props

import { useState } from 'react';
import { TextInput, View, Text, type KeyboardTypeOptions } from 'react-native';
import { Icon } from './Icon';
import { colors } from '@/lib/theme';
import { cn } from '@/lib/cn';

type IconName = string;

export interface TextFieldProps {
  label?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  icon?: IconName;
  error?: string;
  helper?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  editable?: boolean;
  className?: string;
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  error,
  helper,
  secureTextEntry,
  keyboardType,
  autoCapitalize = 'none',
  editable = true,
  className,
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View className={cn('', className)}>
      {label ? <Text className="mb-1.5 text-xs font-bold text-ink-soft">{label}</Text> : null}
      <View
        className={cn(
          'h-12 flex-row items-center gap-2 rounded-xl border bg-paper px-3',
          error ? 'border-hot' : focused ? 'border-gold-600' : 'border-divider',
          !editable && 'bg-surfaceAlt opacity-70',
        )}
      >
        {icon ? <Icon name={icon} size={18} color={colors.inkMute} /> : null}
        <TextInput
          className="flex-1 text-base text-ink"
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.inkMute}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
      {error ? (
        <Text className="mt-1 text-[11px] font-medium text-hot">{error}</Text>
      ) : helper ? (
        <Text className="mt-1 text-[11px] text-ink-mute">{helper}</Text>
      ) : null}
    </View>
  );
}
