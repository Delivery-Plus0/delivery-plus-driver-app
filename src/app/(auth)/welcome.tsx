import { router } from 'expo-router';
import { Image, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/app-button';
import { Icon, type IconName } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { BrandColors, IconSize, Radius, Spacing } from '@/constants/theme';
import { t } from '@/i18n';

const FEATURES: { icon: IconName; title: string; subtitle: string }[] = [
  { icon: 'delivery', title: t('Go online when you want'), subtitle: t('Jobs are assigned to you automatically') },
  { icon: 'store', title: t('Everything for the pickup'), subtitle: t('Restaurant, address and the items to collect') },
  { icon: 'location', title: t('Straight to the door'), subtitle: t('Drop-off address and notes from the customer') },
];

export default function WelcomeScreen() {
  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.hero}>
          <Image
            source={require('@/assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel={t('Delivery Plus')}
          />
          <ThemedText type="title" style={styles.center} accessibilityRole="header">
            {t('Deliver with Delivery Plus.')}
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary" style={styles.center}>
            {t('Go online, receive deliveries automatically, and take every order from the restaurant to the customer.')}
          </ThemedText>
        </View>

        <View style={styles.features}>
          {FEATURES.map((feature) => (
            <View key={feature.title} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Icon name={feature.icon} size={IconSize.md} color={BrandColors.primaryText} />
              </View>
              <View style={styles.featureText}>
                <ThemedText type="smallBold">{feature.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {feature.subtitle}
                </ThemedText>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <AppButton testID="welcome-register" title={t('Become a driver')} onPress={() => router.push('/register')} />
          <AppButton testID="welcome-login" title={t('I already have a driver account')} variant="secondary" onPress={() => router.push('/login')} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.three,
    gap: Spacing.four,
  },
  hero: {
    gap: Spacing.three,
  },
  logo: {
    width: 220,
    height: 64,
    alignSelf: 'center',
    marginBottom: Spacing.two,
  },
  center: {
    textAlign: 'center',
  },
  features: {
    gap: Spacing.three,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    backgroundColor: BrandColors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
  },
  actions: {
    gap: Spacing.three,
  },
});
