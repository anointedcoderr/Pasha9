// Built by Anointed Coder.
//
// Legal + help stack. Groups the hub and every policy / support page under
// the /legal route. Each page paints its own slim back header, so the
// navigator keeps headers hidden and simply pushes light surface screens.

import { Stack } from 'expo-router';
import { colors } from '@/lib/theme';

export const unstable_settings = { initialRouteName: 'index' };

export default function LegalLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.surface },
      }}
    />
  );
}
