// Built by Anointed Coder.
//
// Nested Stack for the Games hub. Declaring the sub-routes here keeps the
// lobby and WinGo screens headerless and gives them clean stack
// transitions WITHOUT touching the root app/_layout.tsx. The root layout
// already registers `games` as a single stack entry; this nested navigator
// owns everything under /games.

import { Stack } from 'expo-router';
import { colors } from '@/lib/theme';

export default function GamesLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.surface },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="wingo" options={{ contentStyle: { backgroundColor: colors.darkbg } }} />
    </Stack>
  );
}
