// Built by Anointed Coder.
//
// Bottom-tab group. Uses a custom BottomTabBar so the layout matches the
// web player app (raised center Home, gold active state, NEW marker on
// Lotto). Screen order below feeds the tab bar's display order.

import { Tabs } from 'expo-router';
import { BottomTabBar } from '@/components/BottomTabBar';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <BottomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="promotions" options={{ title: 'Promotion' }} />
      <Tabs.Screen name="lotto" options={{ title: 'Lotto' }} />
      <Tabs.Screen name="betting-pass" options={{ title: 'Betting Pass' }} />
      <Tabs.Screen name="referral" options={{ title: 'Referral' }} />
    </Tabs>
  );
}
