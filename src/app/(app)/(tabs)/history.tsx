import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/app-button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { InlineAlert } from '@/components/ui/inline-alert';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { Sheet } from '@/components/ui/sheet';
import { ErrorState, StateView } from '@/components/ui/state-view';
import { BrandColors, Radius, Spacing } from '@/constants/theme';
import { ApiError } from '@/services/api';
import { fetchDeliveryHistory, type DriverHistoryItem, type HistoryFilter } from '@/services/deliveries';
import { useDeliveryHistory } from '@/state/driver';
import {
  HISTORY_FILTER_OPTIONS,
  deliveryDuration,
  finishedAt,
  historyStatus,
  historyTimeline,
  mergeHistoryPages,
} from '@/utils/delivery-history';
import { formatDateTime, formatMoney } from '@/utils/format';
import { t } from '@/i18n';

// Getters, so the messages follow the current language (#151).
const EMPTY_MESSAGES: Record<string, string> = {
  get all() {
    return t('Deliveries you take will be listed here.');
  },
  get active() {
    return t('You have no delivery in progress.');
  },
  get completed() {
    return t('Deliveries you complete will be listed here.');
  },
  get cancelled() {
    return t('No cancelled deliveries.');
  },
};

/** History tab (#142): the driver's own deliveries from the backend, newest first. */
export default function HistoryScreen() {
  const [filter, setFilter] = useState<HistoryFilter | null>(null);
  const [selected, setSelected] = useState<DriverHistoryItem | null>(null);

  return (
    <Screen>
      <ScreenHeader title={t('History')} />
      <View style={styles.filters} accessibilityRole="tablist">
        {HISTORY_FILTER_OPTIONS.map((option) => {
          const active = option.key === filter;
          return (
            <Pressable
              key={option.testID}
              testID={option.testID}
              nativeID={option.testID}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setFilter(option.key)}
              style={[styles.chip, active && styles.chipActive]}>
              <ThemedText type="smallBold" style={active ? styles.chipTextActive : undefined}>
                {option.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      {/* Keyed by filter: switching filters starts again from page 1. */}
      <HistoryList key={filter ?? 'all'} filter={filter} onSelect={setSelected} />
      <Sheet
        visible={selected !== null}
        title={selected?.restaurant?.name ?? 'Delivery'}
        onClose={() => setSelected(null)}
        testID="history-detail">
        {selected ? <HistoryDetail item={selected} /> : null}
      </Sheet>
    </Screen>
  );
}

function HistoryList({ filter, onSelect }: { filter: HistoryFilter | null; onSelect: (item: DriverHistoryItem) => void }) {
  const first = useDeliveryHistory(filter);
  const [more, setMore] = useState<DriverHistoryItem[][]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);

  const items = mergeHistoryPages([first.data?.items ?? [], ...more]);
  const total = first.data?.total ?? 0;

  async function refresh() {
    setMore([]);
    setMoreError(null);
    await first.refresh();
  }

  async function loadMore() {
    if (loadingMore) return;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const next = await fetchDeliveryHistory(filter, more.length + 2);
      setMore((pages) => [...pages, next.items]);
    } catch (caught) {
      setMoreError(caught instanceof ApiError ? caught.message : t('Could not load more deliveries.'));
    } finally {
      setLoadingMore(false);
    }
  }

  if (first.isLoading) return <StateView icon="clock" title="Loading your deliveries…" testID="history-loading" />;
  if (first.error && first.data === undefined) return <ErrorState error={first.error} onRetry={() => void first.refresh()} />;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={first.refreshing} onRefresh={() => void refresh()} />}>
      {items.length === 0 ? (
        <StateView icon="delivery" title={t('No deliveries yet')} message={EMPTY_MESSAGES[filter ?? 'all']} testID="history-empty" />
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary" testID="history-count" nativeID="history-count">
            {total === 1 ? '1 delivery' : `${total} deliveries`}
          </ThemedText>
          {items.map((item) => (
            <HistoryRow key={item.id} item={item} onPress={() => onSelect(item)} />
          ))}
          {moreError ? <InlineAlert message={moreError} testID="history-more-error" /> : null}
          {items.length < total ? (
            <AppButton testID="history-load-more" title={t('Load more')} variant="secondary" onPress={() => void loadMore()} loading={loadingMore} />
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

function HistoryRow({ item, onPress }: { item: DriverHistoryItem; onPress: () => void }) {
  const status = historyStatus(item);
  const testID = `history-item-${item.orderId}`;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityHint={t('Shows the delivery details')} testID={testID} nativeID={testID}>
      <Card>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <ThemedText type="defaultBold">{item.restaurant?.name ?? t('Restaurant unavailable')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatDateTime(finishedAt(item))}
              {item.order ? ` · ${formatMoney(item.order.totalAmount)}` : ''}
            </ThemedText>
          </View>
          <Badge label={status.label} tone={status.tone} testID={`${testID}-status`} />
        </View>
      </Card>
    </Pressable>
  );
}

function HistoryDetail({ item }: { item: DriverHistoryItem }) {
  const status = historyStatus(item);
  const duration = deliveryDuration(item);
  return (
    <>
      <View style={styles.row}>
        <Badge label={status.label} tone={status.tone} testID="history-detail-status" />
        {duration ? (
          <ThemedText type="small" themeColor="textSecondary" testID="history-detail-duration" nativeID="history-detail-duration">
            {duration}
          </ThemedText>
        ) : null}
      </View>

      <View style={styles.section} testID="history-detail-timeline" nativeID="history-detail-timeline">
        {historyTimeline(item).map((stage) => (
          <View key={stage.label} style={styles.row}>
            <ThemedText type="small" style={styles.rowText}>
              {stage.label}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatDateTime(stage.at)}
            </ThemedText>
          </View>
        ))}
      </View>

      {item.order ? (
        <View style={styles.section}>
          <ThemedText type="caption" themeColor="textSecondary">
            {t('Drop-off')}
          </ThemedText>
          <ThemedText type="small" testID="history-detail-drop-off" nativeID="history-detail-drop-off">
            {item.order.dropOffAddress ?? t('No address on this order')}
          </ThemedText>
          <ThemedText type="caption" themeColor="textSecondary" style={styles.sectionLabel}>
            {t('Items')}
          </ThemedText>
          {item.order.items.map((line, index) => (
            <ThemedText key={`${line.name}-${index}`} type="small">
              {line.quantity}× {line.name}
            </ThemedText>
          ))}
          <ThemedText type="smallBold" testID="history-detail-total" nativeID="history-detail-total">
            {t('Order total {total}', { total: formatMoney(item.order.totalAmount) })}
          </ThemedText>
        </View>
      ) : (
        <InlineAlert message={t('Order details are unavailable right now.')} testID="history-detail-unavailable" />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + Spacing.half,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: BrandColors.border,
    backgroundColor: BrandColors.surface,
  },
  chipActive: {
    borderColor: BrandColors.primary,
    backgroundColor: BrandColors.primarySoft,
  },
  chipTextActive: {
    color: BrandColors.primaryText,
  },
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
  section: {
    gap: Spacing.one,
  },
  sectionLabel: {
    marginTop: Spacing.two,
  },
});
