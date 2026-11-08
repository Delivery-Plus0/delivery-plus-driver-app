import { Redirect, router } from 'expo-router';
import { useRef, useState } from 'react';
import { Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/app-button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { FormTextInput } from '@/components/ui/form-text-input';
import { Icon } from '@/components/ui/icon';
import { InlineAlert } from '@/components/ui/inline-alert';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { ErrorState, StateView } from '@/components/ui/state-view';
import { BrandColors, IconSize, Radius, Spacing } from '@/constants/theme';
import { t } from '@/i18n';
import { DRIVER_DOCUMENT_TYPES, type DriverApplication, type DriverDocumentType } from '@/services/drivers';
import { saveApplicationDetails, submitApplication, uploadDocument, useMyApplication, useMyDriver } from '@/state/driver';
import {
  APPLICATION_META,
  DOCUMENTS,
  canEditApplication,
  describeApplicationError,
  displayDate,
  expiryError,
  missingItems,
  nationalIdError,
  parseDate,
} from '@/utils/driver-application';

/** Keeps the form readable on tablets and the web. */
const MAX_WIDTH = 720;

/**
 * The driver application (#46): national ID and licence dates, five document photos, then submit.
 * Only a draft or a rejected application is editable; everything is saved as the driver goes, so they
 * can stop and come back.
 */
export default function ApplicationScreen() {
  const driver = useMyDriver();
  const application = useMyApplication(driver.data);

  if (driver.isLoading || application.isLoading) {
    return (
      <Screen>
        <ScreenHeader title={t('Your application')} showBack />
        <StateView icon="clock" title={t('Loading your application…')} testID="application-loading" />
      </Screen>
    );
  }
  if (driver.data === null) return <Redirect href="/home" />;
  const failed = driver.error ?? application.error;
  if (failed && (driver.data === undefined || application.data === undefined)) {
    return (
      <Screen>
        <ScreenHeader title={t('Your application')} showBack />
        <ErrorState error={failed} onRetry={() => void Promise.all([driver.refresh(), application.refresh()])} />
      </Screen>
    );
  }
  if (!application.data) return null;
  // Under review or approved: the Today tab says where it stands.
  if (!canEditApplication(application.data.status)) return <Redirect href="/home" />;

  return <ApplicationForm application={application.data} refreshing={application.refreshing} onRefresh={() => void application.refresh()} />;
}

function ApplicationForm({ application, refreshing, onRefresh }: { application: DriverApplication; refreshing: boolean; onRefresh: () => void }) {
  const [nationalId, setNationalId] = useState('');
  const [drivingExpiry, setDrivingExpiry] = useState(displayDate(application.drivingLicenceExpiresOn));
  const [vehicleExpiry, setVehicleExpiry] = useState(displayDate(application.vehicleLicenceExpiresOn));
  const [detailsSubmitted, setDetailsSubmitted] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [detailsSaved, setDetailsSaved] = useState(false);
  const [documentErrors, setDocumentErrors] = useState<Partial<Record<DriverDocumentType, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const errors = {
    nationalId: nationalIdError(nationalId),
    drivingExpiry: expiryError(drivingExpiry),
    vehicleExpiry: expiryError(vehicleExpiry),
  };
  const missing = missingItems(application);
  const uploaded = new Map(application.documents.map((document) => [document.type, document]));
  const rejected = application.status === 'REJECTED';

  async function once(label: string, action: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(label);
    try {
      await action();
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  async function saveDetails() {
    setDetailsSubmitted(true);
    setDetailsSaved(false);
    if (errors.nationalId || errors.drivingExpiry || errors.vehicleExpiry) return;
    await once('details', async () => {
      setDetailsError(null);
      try {
        await saveApplicationDetails({
          nationalIdNumber: nationalId.replace(/\s/g, ''),
          drivingLicenceExpiresOn: parseDate(drivingExpiry) as string,
          vehicleLicenceExpiresOn: parseDate(vehicleExpiry) as string,
        });
        setNationalId('');
        setDetailsSubmitted(false);
        setDetailsSaved(true);
      } catch (caught) {
        setDetailsError(describeApplicationError(caught, t('Unable to save your details right now.')));
      }
    });
  }

  async function upload(type: DriverDocumentType, source: 'camera' | 'library') {
    await once(type, async () => {
      setDocumentErrors((current) => ({ ...current, [type]: undefined }));
      try {
        await uploadDocument(type, source);
      } catch (caught) {
        setDocumentErrors((current) => ({ ...current, [type]: describeApplicationError(caught, t('The upload did not go through. Try again.')) }));
      }
    });
  }

  async function submit() {
    await once('submit', async () => {
      setSubmitError(null);
      try {
        await submitApplication();
        router.replace('/home');
      } catch (caught) {
        setSubmitError(describeApplicationError(caught, t('Unable to submit your application right now.')));
      }
    });
  }

  return (
    <Screen>
      <ScreenHeader title={t('Your application')} subtitle={t('Delivery Plus checks every driver before their first delivery.')} showBack />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={styles.row}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
            {t('Your documents are private: only the review team can open them.')}
          </ThemedText>
          <Badge label={APPLICATION_META[application.status].label} tone={APPLICATION_META[application.status].tone} testID="application-status-badge" />
        </View>

        {rejected ? (
          <Card testID="application-review-note">
            <View style={styles.row}>
              <Icon name="error" size={IconSize.md} color={BrandColors.danger} />
              <ThemedText type="defaultBold">{t('Your application needs changes')}</ThemedText>
            </View>
            <ThemedText type="small">{application.lastReview?.note ?? application.verificationNote ?? t('The reviewer did not leave a note.')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('Fix what the note says, replace any document that needs it, then submit again.')}
            </ThemedText>
          </Card>
        ) : application.verificationNote ? (
          // Sent back to a draft by the licence check (#207): the note says why.
          <InlineAlert tone="info" message={application.verificationNote} testID="application-note" />
        ) : null}

        <Card testID="application-details">
          <ThemedText type="subtitle" accessibilityRole="header">
            {t('1. Your details')}
          </ThemedText>
          <FormTextInput
            testID="application-national-id"
            label={t('National ID number')}
            icon="shield"
            keyboardType="number-pad"
            maxLength={17}
            value={nationalId}
            onChangeText={(value) => {
              setNationalId(value);
              setDetailsSaved(false);
            }}
            hint={
              application.nationalIdLast4
                ? t('Saved, ending in {last4}. Enter it again to change your dates.', { last4: application.nationalIdLast4 })
                : t('The 14 digits on your card. We keep only the last 4.')
            }
            error={detailsSubmitted ? errors.nationalId : undefined}
          />
          <FormTextInput
            testID="application-driving-expiry"
            label={t('Driving licence expiry date')}
            icon="clock"
            placeholder="31/05/2028"
            value={drivingExpiry}
            onChangeText={setDrivingExpiry}
            hint={t('Day/month/year, as printed on the licence')}
            error={detailsSubmitted ? errors.drivingExpiry : undefined}
          />
          <FormTextInput
            testID="application-vehicle-expiry"
            label={t('Vehicle licence expiry date')}
            icon="clock"
            placeholder="15/01/2027"
            value={vehicleExpiry}
            onChangeText={setVehicleExpiry}
            hint={t('Day/month/year, as printed on the licence')}
            error={detailsSubmitted ? errors.vehicleExpiry : undefined}
          />
          {detailsError ? <InlineAlert message={detailsError} testID="application-details-error" /> : null}
          {detailsSaved ? <InlineAlert tone="success" message={t('Details saved.')} testID="application-details-saved" /> : null}
          <AppButton testID="application-save-details" title={t('Save details')} variant="secondary" loading={busy === 'details'} onPress={() => void saveDetails()} />
        </Card>

        <Card testID="application-documents">
          <ThemedText type="subtitle" accessibilityRole="header">
            {t('2. Documents')}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('Clear photos in good light, the whole document in the frame. JPEG or PNG, up to 10 MB each.')}
          </ThemedText>
          {DRIVER_DOCUMENT_TYPES.map((type) => {
            const document = uploaded.get(type);
            const error = documentErrors[type];
            return (
              <View key={type} style={styles.document} testID={`document-${type}`} nativeID={`document-${type}`}>
                <View style={styles.row}>
                  <Icon name={document ? 'checkMark' : 'user'} size={IconSize.md} color={document ? BrandColors.success : BrandColors.textSecondary} />
                  <View style={styles.flex}>
                    <ThemedText type="defaultBold">{DOCUMENTS[type].label}</ThemedText>
                    <ThemedText type="caption" themeColor="textSecondary">
                      {DOCUMENTS[type].hint}
                    </ThemedText>
                  </View>
                  <Badge label={document ? t('Uploaded') : t('Missing')} tone={document ? 'success' : 'neutral'} testID={`document-${type}-status`} />
                </View>
                {error ? <InlineAlert message={error} testID={`document-${type}-error`} /> : null}
                <View style={styles.actions}>
                  {Platform.OS !== 'web' ? (
                    <AppButton testID={`document-${type}-camera`} title={document ? t('Retake') : t('Take photo')} size="sm" fullWidth={false} loading={busy === type} onPress={() => void upload(type, 'camera')} />
                  ) : null}
                  <AppButton
                    testID={`document-${type}-library`}
                    title={error ? t('Try again') : document ? t('Replace') : t('Choose photo')}
                    variant="secondary"
                    size="sm"
                    fullWidth={false}
                    loading={busy === type}
                    onPress={() => void upload(type, 'library')}
                  />
                </View>
              </View>
            );
          })}
        </Card>

        <Card testID="application-review">
          <ThemedText type="subtitle" accessibilityRole="header">
            {t('3. Review and submit')}
          </ThemedText>
          {missing.length ? (
            <View style={styles.missing} testID="application-missing" nativeID="application-missing">
              <ThemedText type="smallBold">{t('Still needed')}</ThemedText>
              {missing.map((item) => (
                <View key={item} style={styles.row}>
                  <Icon name="error" size={16} color={BrandColors.danger} />
                  <ThemedText type="small" style={styles.flex}>
                    {item}
                  </ThemedText>
                </View>
              ))}
            </View>
          ) : (
            <InlineAlert tone="info" message={t('Everything is in place. Our team reviews your application and you can go online once it is approved.')} testID="application-ready" />
          )}
          {submitError ? <InlineAlert message={submitError} testID="application-submit-error" /> : null}
          <AppButton
            testID="application-submit"
            title={rejected ? t('Submit again') : t('Submit for review')}
            disabled={!application.canSubmit}
            loading={busy === 'submit'}
            onPress={() => void submit()}
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MAX_WIDTH,
    alignSelf: 'center',
  },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  document: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radius.md,
    backgroundColor: BrandColors.surfaceMuted,
  },
  missing: { gap: Spacing.one },
});
