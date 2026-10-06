import { Redirect, Stack } from 'expo-router';
import { useEffect } from 'react';

import { BrandColors } from '@/constants/theme';
import { clearSession, useAuthSession } from '@/services/session';
import { DRIVER_ROLE } from '@/utils/driver-status';

export default function AppLayout() {
  const { hydrated, session } = useAuthSession();
  const notADriver = Boolean(session && session.user.role !== DRIVER_ROLE);

  useEffect(() => {
    // Sign-in already refuses other roles; this covers a session stored by an older build or another app.
    if (notADriver) void clearSession();
  }, [notADriver]);

  if (!hydrated) {
    return null;
  }

  if (!session || notADriver) {
    return <Redirect href="/welcome" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: BrandColors.background } }}>
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
