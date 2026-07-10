// Built by Anointed Coder.
//
// Auth stack. Groups the login, register and forgot-password screens under
// the /auth route (presented modally by the root Stack). Headers are hidden
// because each auth screen paints its own dark premium chrome. The dark
// contentStyle keeps transitions from flashing white between screens.

import { Stack } from 'expo-router';
import { colors } from '@/lib/theme';

// Land on the login screen when the group is opened without a specific child.
export const unstable_settings = { initialRouteName: 'login' };

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.darkbg },
      }}
    />
  );
}
