import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { BrandColors } from '@/constants/theme';
import { t } from '@/i18n';

function tabIcon(name: IconName) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Icon name={name} color={color} size={size} />;
  };
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: BrandColors.primaryText,
        tabBarInactiveTintColor: BrandColors.textSecondary,
        tabBarStyle: { backgroundColor: BrandColors.surface, borderTopColor: BrandColors.border },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
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
