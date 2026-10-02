import { useRef, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/app-button';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { FormTextInput } from '@/components/ui/form-text-input';
import { Icon } from '@/components/ui/icon';
import { InlineAlert } from '@/components/ui/inline-alert';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { ErrorState, StateView } from '@/components/ui/state-view';
import { BrandColors, IconSize, Spacing } from '@/constants/theme';
import { ApiError } from '@/services/api';
import type { CurrentDelivery } from '@/services/deliveries';
import type { Driver, DriverStatus } from '@/services/drivers';
import { clearSession, useAuthSession } from '@/services/session';
import { advanceDelivery, registerMyVehicle, setOnline, useCurrentDelivery, useMyDriver } from '@/state/driver';
import { confirm } from '@/utils/confirm';
import { formatMoney } from '@/utils/format';
import {
  ACTION_LABELS,
  DELIVERY_STAGE_LABELS,
  DRIVER_STATUS_LABELS,
  canToggleOnline,
  isOnShift,
  nextAction,
} from '@/utils/driver-status';

const STATUS_TONES: Record<DriverStatus, BadgeTone> = {
  OFFLINE: 'neutral',
  AVAILABLE: 'success',
  BUSY: 'brand',
  SUSPENDED: 'danger',
};

const errorMessage = (caught: unknown, fallback: string) => (caught instanceof ApiError ? caught.message : fallback);

export default function HomeScreen() {
  const { session } = useAuthSession();
  const driver = useMyDriver();
  const delivery = useCurrentDelivery(driver.data);

  async function signOut() {
    const ok = await confirm({ title: 'Sign out?', message: 'You can sign back in at any time.', confirmLabel: 'Sign out' });
    if (ok) await clearSession();
  }

  async function refreshAll() {
    await Promise.all([driver.refresh(), isOnShift(driver.data?.status) ? delivery.refresh() : Promise.resolve()]);
  }

  return (
    <Screen>
      <ScreenHeader
        title="Delivery Plus Driver"
        subtitle={session?.user.email}
        right={<AppButton testID="sign-out" title="Sign out" icon="logout" variant="ghost" size="sm" onPress={() => void signOut()} />}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={driver.refreshing || delivery.refreshing} onRefresh={() => void refreshAll()} />}>
        {driver.isLoading ? (
          <StateView icon="clock" title="Loading your profile…" testID="driver-loading" />
        ) : driver.error && driver.data === undefined ? (
          <ErrorState error={driver.error} onRetry={() => void driver.refresh()} />
        ) : driver.data === null ? (
          <VehicleForm />
        ) : driver.data ? (
          <>
            <StatusCard driver={driver.data} />
            {isOnShift(driver.data.status) ? (
              delivery.isLoading ? (
                <StateView icon="clock" title="Checking for a job…" testID="delivery-loading" />
              ) : delivery.error && delivery.data === undefined ? (
                <ErrorState error={delivery.error} onRetry={() => void delivery.refresh()} />
              ) : delivery.data ? (
                <DeliveryCard delivery={delivery.data} />
              ) : (
                <StateView
                  icon="delivery"
                  title="Waiting for a job"
                  message="New deliveries are assigned to you automatically. This screen checks every few seconds."
                  testID="waiting-for-job"
                />
              )
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

/** First use: the driver profile doesn't exist until the vehicle is registered. */
function VehicleForm() {
  const [vehicleType, setVehicleType] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inFlight = useRef(false);

  // Mirrors driver-service RegisterDriverDto (both at least 2 characters).
  const vehicleError = vehicleType.trim().length < 2 ? 'Enter your vehicle type (e.g. Scooter)' : undefined;
  const plateError = licensePlate.trim().length < 2 ? 'Enter your license plate' : undefined;

  async function submit() {
    setSubmitted(true);
    if (vehicleError || plateError || inFlight.current) return;
    inFlight.current = true;
    setIsSubmitting(true);
    setError(null);
    try {
      await registerMyVehicle({ vehicleType: vehicleType.trim(), licensePlate: licensePlate.trim() });
    } catch (caught) {
      setError(errorMessage(caught, 'Unable to register your vehicle right now.'));
    } finally {
      inFlight.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <Card testID="vehicle-form">
      <ThemedText type="subtitle" accessibilityRole="header">
        Register your vehicle
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.paragraph}>
        You need a registered vehicle before you can go online and receive deliveries.
      </ThemedText>
      <FormTextInput
        testID="vehicle-type"
        label="Vehicle type"
        value={vehicleType}
        onChangeText={setVehicleType}
        error={submitted ? vehicleError : undefined}
        placeholder="Scooter, Car, Bicycle…"
      />
      <FormTextInput
        testID="license-plate"
        label="License plate"
        value={licensePlate}
        onChangeText={setLicensePlate}
        error={submitted ? plateError : undefined}
        autoCapitalize="characters"
        placeholder="ABC-1234"
        onSubmitEditing={() => void submit()}
      />
      {error ? <InlineAlert message={error} testID="vehicle-error" /> : null}
      <AppButton testID="register-vehicle" title="Register vehicle" onPress={() => void submit()} loading={isSubmitting} />
    </Card>
  );
}

function StatusCard({ driver }: { driver: Driver }) {
  const [error, setError] = useState<string | null>(null);
  const [isSwitching, setIsSwitching] = useState(false);
  const inFlight = useRef(false);
  const online = driver.status === 'AVAILABLE';

  async function toggle() {
    if (inFlight.current || !canToggleOnline(driver.status)) return;
    inFlight.current = true;
    setIsSwitching(true);
    setError(null);
    try {
      await setOnline(!online);
    } catch (caught) {
      setError(errorMessage(caught, 'Unable to change your status right now.'));
    } finally {
      inFlight.current = false;
      setIsSwitching(false);
    }
  }

  return (
    <Card testID="status-card">
      <View style={styles.row}>
        <View style={styles.rowText}>
          <ThemedText type="smallBold">
            {driver.vehicleType} · {driver.licensePlate}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Your status
          </ThemedText>
        </View>
        <Badge label={DRIVER_STATUS_LABELS[driver.status]} tone={STATUS_TONES[driver.status]} testID="driver-status" />
      </View>
      {driver.status === 'BUSY' ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.paragraph}>
          You go back online automatically when this delivery is completed.
        </ThemedText>
      ) : driver.status === 'SUSPENDED' ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.paragraph}>
          Your account is suspended. Contact support to be reinstated.
        </ThemedText>
      ) : (
        <AppButton
          testID={online ? 'go-offline' : 'go-online'}
          title={online ? 'Go offline' : 'Go online'}
          variant={online ? 'secondary' : 'primary'}
          onPress={() => void toggle()}
          loading={isSwitching}
        />
      )}
      {error ? <InlineAlert message={error} testID="status-error" /> : null}
    </Card>
  );
}

function DeliveryCard({ delivery }: { delivery: CurrentDelivery }) {
  const [error, setError] = useState<string | null>(null);
  const [isActing, setIsActing] = useState(false);
  const inFlight = useRef(false);
  const action = nextAction(delivery);

  async function act() {
    if (!action || inFlight.current) return;
    inFlight.current = true;
    setIsActing(true);
    setError(null);
    try {
      await advanceDelivery(delivery.id, action);
    } catch (caught) {
      // Delivery actions are retry-safe on the server, so pressing again after a failure is safe.
      setError(errorMessage(caught, 'That did not go through. Check your connection and try again.'));
    } finally {
      inFlight.current = false;
      setIsActing(false);
    }
  }

  return (
    <Card testID="current-delivery">
      <View style={styles.row}>
        <ThemedText type="subtitle" accessibilityRole="header" style={styles.rowText}>
          Current delivery
        </ThemedText>
        <Badge label={DELIVERY_STAGE_LABELS[delivery.status]} tone="brand" testID="delivery-stage" />
      </View>

      <Stop
        icon="store"
        label="Pickup"
        title={delivery.pickup.name}
        detail={delivery.pickup.address}
        testID="pickup"
      />
      <Stop
        icon="location"
        label="Drop-off"
        title={delivery.dropOff.address ?? 'No address on this order'}
        detail={delivery.dropOff.notes ?? undefined}
        testID="drop-off"
      />

      <View style={styles.items} testID="order-items" nativeID="order-items">
        {delivery.order.items.map((item, index) => (
          <ThemedText key={`${item.name}-${index}`} type="small">
            {item.quantity}× {item.name}
          </ThemedText>
        ))}
        <ThemedText type="smallBold" testID="order-total">
          Total {formatMoney(delivery.order.totalAmount)}
        </ThemedText>
      </View>

      {error ? <InlineAlert message={error} testID="delivery-error" /> : null}
      {action ? (
        <AppButton testID={`delivery-action-${action}`} title={ACTION_LABELS[action]} onPress={() => void act()} loading={isActing} />
      ) : null}
    </Card>
  );
}

function Stop({ icon, label, title, detail, testID }: { icon: 'store' | 'location'; label: string; title: string; detail?: string; testID: string }) {
  return (
    // nativeID too: react-native-web renders it as the HTML id that Maestro's web driver looks up.
    <View style={styles.stop} testID={testID} nativeID={testID}>
      <Icon name={icon} size={IconSize.md} color={BrandColors.primaryText} />
      <View style={styles.rowText}>
        <ThemedText type="caption" themeColor="textSecondary">
          {label}
        </ThemedText>
        <ThemedText type="defaultBold">{title}</ThemedText>
        {detail ? (
          <ThemedText type="small" themeColor="textSecondary">
            {detail}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  paragraph: {
    marginVertical: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  rowText: {
    flex: 1,
  },
  stop: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginVertical: Spacing.two,
  },
  items: {
    gap: Spacing.one,
    marginVertical: Spacing.two,
  },
});
