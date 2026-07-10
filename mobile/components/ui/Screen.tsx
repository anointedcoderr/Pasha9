// Built by Anointed Coder.
//
// Screen: the standard page wrapper. Applies the surface background, safe-
// area insets, and (by default) a vertical ScrollView. Every screen should
// be wrapped in this so padding, insets and scroll behaviour stay uniform.
//
// Props:
//   scroll            boolean   wrap children in a ScrollView (default true)
//   header            ReactNode fixed element above the scroll area (AppHeader)
//   footer            ReactNode fixed element below the scroll area
//   edges             Edge[]    safe-area edges to pad (default ['top'])
//   contentClassName  string    override padding on the scroll content
//   className         string    override the outer container
//   refreshControl    element   optional pull-to-refresh control
//
// Example:
//   <Screen header={<AppHeader />}>
//     <SectionHeader title="Hot Games" />
//     ...
//   </Screen>

import type { ReactElement, ReactNode } from 'react';
import { ScrollView, View, type RefreshControlProps } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { cn } from '@/lib/cn';

export interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  header?: ReactNode;
  footer?: ReactNode;
  edges?: Edge[];
  contentClassName?: string;
  className?: string;
  refreshControl?: ReactElement<RefreshControlProps>;
}

export function Screen({
  children,
  scroll = true,
  header,
  footer,
  edges = ['top'],
  contentClassName,
  className,
  refreshControl,
}: ScreenProps) {
  return (
    <SafeAreaView edges={edges} className={cn('flex-1 bg-surface', className)}>
      {header}
      {scroll ? (
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 112 }}
          refreshControl={refreshControl}
        >
          <View className={cn('px-4 pt-3', contentClassName)}>{children}</View>
        </ScrollView>
      ) : (
        <View className={cn('flex-1 px-4 pt-3', contentClassName)}>{children}</View>
      )}
      {footer}
    </SafeAreaView>
  );
}
