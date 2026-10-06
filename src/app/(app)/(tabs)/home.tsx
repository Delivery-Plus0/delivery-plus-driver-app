import { useRef, useState } from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/app-button';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { FormTextInput } from '@/components/ui/form-text-input';
import { Icon } from '@/components/ui/icon';
import { InlineAlert } from '@/components/ui/inline-alert';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { ErrorState, StateView } from '@/components/ui/state-view';
import { BrandColors, IconSize, Spacing } from '@/constants/theme';
import { useLocationSharing } from '@/hooks/use-location-sharing';
import { ApiError } from '@/services/api';
import type { CurrentDelivery, DeliveryStatus } from '@/services/deliveries';
import type { Driver, DriverStatus } from '@/services/drivers';
import { advanceDelivery, registerMyVehicle, setOnline, useCurrentDelivery, useMyDriver } from '@/state/driver';
import { deliveryProgressLabel, deliverySteps, type DeliveryStepState } from '@/utils/delivery-steps';
import { formatMoney } from '@/utils/format';
import {
  ACTION_CONFIRMATIONS,
  ACTION_LABELS,
  DELIVERY_STAGE_LABELS,
  DRIVER_STATUS_LABELS,
  canToggleOnline,
  isOnShift,
  nextAction,
} from '@/utils/driver-status';
import { LOCATION_SHARING_LABELS, shouldShareLocation, type LocationSharingState } from '@/utils/location-sharing';
import { directionsUrl } from '@/utils/maps';

const STATUS_TONES: Record<DriverStatus, BadgeTone> = {
  OFFLINE: 'neutral',
  AVAILABLE: 'success',
  BUSY: 'brand',
  SUSPENDED: 'danger',
};

const errorMessage = (caught: unknown, fallback: string) => (caught instanceof ApiError ? caught.message : fallback);

const todayLabel = () => new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

/** Today tab: the driver's status and, while on shift, the current job or what to expect next. */
export default function HomeScreen() {
  const driver = useMyDriver();
  const delivery = useCurrentDelivery(driver.data);

  async function refreshAll() {
    await Promise.all([driver.refresh(), isOnShift(driver.data?.status) ? delivery.refresh() : Promise.resolve()]);
  }

  return (
    <Screen>
      <ScreenHeader title="Today" subtitle={todayLabel()} />
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
            ) : driver.data.status === 'OFFLINE' ? (
              <StateView
                icon="offline"
                title="You're offline"
                message="Go online to receive deliveries. Jobs are assigned automatically to drivers who are online, and this screen shows the next one as soon as it is yours."
                testID="offline-guidance"
              />
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
  const [confirming, setConfirming] = useState(false);
  const action = nextAction(delivery);
  const locationState = useLocationSharing(shouldShareLocation(delivery.status));
  const confirmation = action ? ACTION_CONFIRMATIONS[action] : null;

  async function act() {
    setConfirming(false);
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
      <StepProgress status={delivery.status} />

      <Stop
        icon="store"
        label="Pickup"
        title={delivery.pickup.name}
        detail={delivery.pickup.address}
        mapsUrl={directionsUrl({ address: [delivery.pickup.name, delivery.pickup.address].filter(Boolean).join(', ') })}
        testID="pickup"
      />
      <Stop
        icon="location"
        label="Drop-off"
        title={delivery.dropOff.address ?? 'No address on this order'}
        detail={delivery.dropOff.notes ?? undefined}
        mapsUrl={directionsUrl(delivery.dropOff)}
        testID="drop-off"
      />
      <LocationLine state={locationState} />

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
        <AppButton testID={`delivery-action-${action}`} title={ACTION_LABELS[action]} onPress={() => setConfirming(true)} loading={isActing} />
      ) : null}
      {confirmation ? (
        <Dialog
          visible={confirming}
          title={confirmation.title}
          message={confirmation.message}
          confirmLabel={confirmation.confirmLabel}
          onConfirm={() => void act()}
          onCancel={() => setConfirming(false)}
          testID="delivery-confirm"
        />
      ) : null}
    </Card>
  );
}

const STEP_COLORS: Record<DeliveryStepState, string> = {
  done: BrandColors.success,
  current: BrandColors.primary,
  upcoming: BrandColors.border,
};

function StepProgress({ status }: { status: DeliveryStatus }) {
  const label = deliveryProgressLabel(status);
  return (
    <View style={styles.progress} testID="delivery-steps" nativeID="delivery-steps">
      <View style={styles.progressBar}>
        {deliverySteps(status).map((step) => (
          <View
            key={step.key}
            style={[styles.progressSegment, { backgroundColor: STEP_COLORS[step.state] }]}
            accessibilityLabel={`${step.label}: ${step.state}`}
          />
        ))}
      </View>
      {label ? (
        <ThemedText type="caption" themeColor="textSecondary" testID="delivery-progress" nativeID="delivery-progress">
          {label}
        </ThemedText>
      ) : null}
    </View>
  );
}

function LocationLine({ state }: { state: LocationSharingState }) {
  return (
    <View style={styles.stop} testID="location-sharing" nativeID="location-sharing">
      <Icon name="location" size={IconSize.md} color={state === 'sharing' ? BrandColors.primaryText : undefined} />
      <ThemedText type="small" themeColor={state === 'sharing' ? 'text' : 'textSecondary'} style={styles.rowText} testID="location-status">
        {LOCATION_SHARING_LABELS[state]}
      </ThemedText>
    </View>
  );
}

type StopProps = { icon: 'store' | 'location'; label: string; title: string; detail?: string; mapsUrl?: string | null; testID: string };

function Stop({ icon, label, title, detail, mapsUrl, testID }: StopProps) {
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
      {mapsUrl ? (
        <AppButton
          testID={`${testID}-maps`}
          title="Directions"
          icon="directions"
          variant="ghost"
          size="sm"
          fullWidth={false}
          accessibilityHint={`Opens your maps app with directions to the ${label.toLowerCase()}`}
          onPress={() => void Linking.openURL(mapsUrl)}
        />
      ) : null}
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
  progress: {
    gap: Spacing.one,
    marginBottom: Spacing.two,
  },
  progressBar: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  progressSegment: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  items: {
    gap: Spacing.one,
    marginVertical: Spacing.two,
  },
});
