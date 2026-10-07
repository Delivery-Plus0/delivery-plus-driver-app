import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/app-button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Icon, type IconName } from '@/components/ui/icon';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { BrandColors, IconSize, Spacing } from '@/constants/theme';
import { clearSession, useAuthSession } from '@/services/session';
import { useMyDriver, useMyRatingSummary } from '@/state/driver';
import { formatDateTime } from '@/utils/format';
import { ratingSummaryLabel, starsText } from '@/utils/rating';

/** Account and vehicle as the backend has them. Editing them is #147/#150. */
export default function ProfileScreen() {
  const { session } = useAuthSession();
  const driver = useMyDriver();
  const rating = useMyRatingSummary();
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

  return (
    <Screen>
      <ScreenHeader title="Profile" />
      <ScrollView contentContainerStyle={styles.content}>
        <Card testID="profile-account">
          <Row icon="mail" label="Email" value={session?.user.email ?? ''} testID="profile-email" />
        </Card>
        <Card testID="profile-vehicle">
          {driver.data ? (
            <Row icon="delivery" label="Vehicle" value={`${driver.data.vehicleType} · ${driver.data.licensePlate}`} testID="profile-vehicle-value" />
          ) : (
            <Row
              icon="delivery"
              label="Vehicle"
              value={driver.data === null ? 'Not registered yet. Register it on the Today tab.' : '…'}
              testID="profile-vehicle-value"
            />
          )}
        </Card>
        {rating.data ? (
          <Card testID="profile-rating">
            <ThemedText type="caption" themeColor="textSecondary">
              Rating from customers
            </ThemedText>
            <ThemedText type="defaultBold" testID="profile-rating-summary" nativeID="profile-rating-summary">
              {ratingSummaryLabel(rating.data)}
            </ThemedText>
            {rating.data.recentComments.map((comment, index) => (
              <View key={`${comment.createdAt}-${index}`} style={styles.comment} testID={`profile-rating-comment-${index}`}>
                <ThemedText type="small" style={styles.commentStars}>
                  {starsText(comment.score)}
                </ThemedText>
                <ThemedText type="small">“{comment.comment}”</ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  {formatDateTime(comment.createdAt)}
                </ThemedText>
              </View>
            ))}
          </Card>
        ) : null}
        <AppButton testID="sign-out" title="Sign out" icon="logout" variant="secondary" onPress={() => setConfirmingSignOut(true)} />
      </ScrollView>
      <Dialog
        visible={confirmingSignOut}
        title="Sign out?"
        message="You can sign back in at any time."
        confirmLabel="Sign out"
        destructive
        onConfirm={() => {
          setConfirmingSignOut(false);
          void clearSession();
        }}
        onCancel={() => setConfirmingSignOut(false)}
        testID="sign-out-dialog"
      />
    </Screen>
  );
}

function Row({ icon, label, value, testID }: { icon: IconName; label: string; value: string; testID: string }) {
  return (
    <View style={styles.row}>
      <Icon name={icon} size={IconSize.md} color={BrandColors.primaryText} />
      <View style={styles.rowText}>
        <ThemedText type="caption" themeColor="textSecondary">
          {label}
        </ThemedText>
        <ThemedText type="defaultBold" testID={testID} nativeID={testID}>
          {value}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rowText: {
    flex: 1,
  },
  comment: {
    gap: Spacing.half,
    marginTop: Spacing.two,
  },
  commentStars: {
    color: BrandColors.primaryText,
  },
});
