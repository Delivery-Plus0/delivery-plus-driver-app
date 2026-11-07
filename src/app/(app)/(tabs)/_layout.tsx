import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { TabBarIcon, type IconName } from '@/components/ui/icon';
import { BrandColors, TabBar } from '@/constants/theme';
import { t } from '@/i18n';

function tabIcon(name: IconName) {
  return function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <TabBarIcon name={name} color={color} focused={focused} />;
  };
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: BrandColors.primaryText,
        tabBarInactiveTintColor: BrandColors.textSecondary,
        // #45: shared tab-bar sizes leave room for the whole label on the web.
        tabBarStyle: [{ backgroundColor: BrandColors.surface, borderTopColor: BrandColors.border }, TabBar.style],
        tabBarLabelStyle: TabBar.labelStyle,
        sceneStyle: { backgroundColor: BrandColors.background },
      }}
    >
      <Tabs.Screen name="home" options={{ title: t('Today'), tabBarIcon: tabIcon('home'), tabBarButtonTestID: 'tab-today' }} />
      <Tabs.Screen name="history" options={{ title: t('History'), tabBarIcon: tabIcon('clock'), tabBarButtonTestID: 'tab-history' }} />
      <Tabs.Screen name="wallet" options={{ title: t('Wallet'), tabBarIcon: tabIcon('wallet'), tabBarButtonTestID: 'tab-wallet' }} />
      <Tabs.Screen name="profile" options={{ title: t('Profile'), tabBarIcon: tabIcon('person'), tabBarButtonTestID: 'tab-profile' }} />
    </Tabs>
  );
}
