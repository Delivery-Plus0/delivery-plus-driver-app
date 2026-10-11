import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { ErrorState, StateView } from '@/components/ui/state-view';
import { BrandColors, Spacing } from '@/constants/theme';
import type { EarningEntry } from '@/services/earnings';
import { useMyEarnings } from '@/state/driver';
import { formatDateTime, formatMoney } from '@/utils/format';
import { earningStatus, earningTypeLabel, settlementNote } from '@/utils/wallet';
import { t } from '@/i18n';

/**
 * Wallet (#146): the driver's earnings exactly as the backend ledger reports them (#145). Every
 * amount and status comes from GET /deliveries/me/earnings; nothing is computed here.
 */
export default function WalletScreen() {
  const earnings = useMyEarnings();

  return (
    <Screen>
      <ScreenHeader title={t('Wallet')} />
      {earnings.isLoading ? (
        <StateView icon="clock" title="Loading your earnings…" testID="wallet-loading" />
      ) : earnings.error && earnings.data === undefined ? (
        <ErrorState error={earnings.error} onRetry={() => void earnings.refresh()} />
      ) : earnings.data ? (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={earnings.refreshing} onRefresh={() => void earnings.refresh()} />}>
          <Card testID="wallet-summary">
            <ThemedText type="caption" themeColor="textSecondary">
              {t('Available')}
            </ThemedText>
            <ThemedText type="title" testID="wallet-available" nativeID="wallet-available">
              {formatMoney(earnings.data.available)}
            </ThemedText>
            <View style={styles.row}>
              <View style={styles.flex}>
                <ThemedText type="caption" themeColor="textSecondary">
                  {t('Pending')}
                </ThemedText>
                <ThemedText type="defaultBold" testID="wallet-pending" nativeID="wallet-pending">
                  {formatMoney(earnings.data.pending)}
                </ThemedText>
              </View>
              <View style={styles.flex}>
                <ThemedText type="caption" themeColor="textSecondary">
                  {t('Total earned')}
                </ThemedText>
                <ThemedText type="defaultBold" testID="wallet-balance" nativeID="wallet-balance">
                  {formatMoney(earnings.data.balance)}
                </ThemedText>
              </View>
            </View>
            <ThemedText type="small" themeColor="textSecondary" style={styles.note} testID="wallet-settlement" nativeID="wallet-settlement">
              {settlementNote(earnings.data.settlementHours)} {t('Payouts to a bank account are not available yet.')}
            </ThemedText>
          </Card>

          {earnings.data.entries.length === 0 ? (
            <StateView
              icon="wallet"
              title={t('No earnings yet')}
              message={t('You earn a share of the delivery fee for every delivery you complete.')}
              testID="wallet-empty"
            />
          ) : (
            <Card testID="wallet-entries">
              <ThemedText type="smallBold" accessibilityRole="header">
                {t('Recent earnings')}
              </ThemedText>
              {earnings.data.entries.map((entry, index) => (
                <EntryRow key={entry.id} entry={entry} first={index === 0} />
              ))}
            </Card>
          )}
        </ScrollView>
      ) : null}
    </Screen>
  );
}

function EntryRow({ entry, first }: { entry: EarningEntry; first: boolean }) {
  const status = earningStatus(entry);
  const testID = `wallet-entry-${entry.orderId}`;
  return (
    <View style={[styles.entry, !first && styles.entryDivider]} testID={testID} nativeID={testID}>
      <View style={styles.flex}>
        <ThemedText type="default">{earningTypeLabel(entry)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {entry.status === 'PENDING' ? t('Available {date}', { date: formatDateTime(entry.availableAt) }) : formatDateTime(entry.createdAt)}
        </ThemedText>
      </View>
      <View style={styles.amount}>
        <ThemedText type="defaultBold" testID={`${testID}-amount`} nativeID={`${testID}-amount`}>
          {formatMoney(entry.amount)}
        </ThemedText>
        <Badge label={status.label} tone={status.tone} testID={`${testID}-status`} />
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
    gap: Spacing.three,
    marginTop: Spacing.three,
  },
  flex: {
    flex: 1,
  },
  note: {
    marginTop: Spacing.three,
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  entryDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BrandColors.divider,
  },
  amount: {
    alignItems: 'flex-end',
    gap: Spacing.one,
  },
});
