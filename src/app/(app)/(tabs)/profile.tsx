import { Image } from 'expo-image';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PhoneVerificationSheet } from '@/components/phone-verification-sheet';
import { ThemedText } from '@/components/themed-text';
import { AppButton } from '@/components/ui/app-button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { FormTextInput } from '@/components/ui/form-text-input';
import { Icon, type IconName } from '@/components/ui/icon';
import { InlineAlert } from '@/components/ui/inline-alert';
import { LanguageSwitch } from '@/components/ui/language-switch';
import { Screen, ScreenHeader } from '@/components/ui/screen';
import { Sheet } from '@/components/ui/sheet';
import { BrandColors, IconSize, Radius, Spacing } from '@/constants/theme';
import { ApiError, signOut } from '@/services/api';
import type { Driver } from '@/services/drivers';
import { useAuthSession } from '@/services/session';
import type { UserProfile } from '@/services/users';
import { changeMyAvatar, removeMyPhoto, saveMyProfile, updateMyVehicle, useMyDriver, useMyProfile, useMyRatingSummary } from '@/state/driver';
import { canEditVehicle, detailsProblems, VERIFICATION_META, vehicleProblems } from '@/utils/driver-profile';
import { formatDateTime } from '@/utils/format';
import { formatPhone, normalizeEgyptianMobile, PHONE_HINT } from '@/utils/phone';
import { ratingSummaryLabel, starsText } from '@/utils/rating';
import { t } from '@/i18n';

type OpenSheet = 'photo' | 'details' | 'vehicle' | 'verify' | null;

/** The driver's own profile (#147): photo, name and phone (user-service), vehicle and review (driver-service), rating. */
export default function ProfileScreen() {
  const { session } = useAuthSession();
  const driver = useMyDriver();
  const profile = useMyProfile();
  const rating = useMyRatingSummary();
  const [sheet, setSheet] = useState<OpenSheet>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

  function done(message: string) {
    setSheet(null);
    setNotice(message);
  }

  const verification = driver.data?.verificationStatus ? VERIFICATION_META[driver.data.verificationStatus] : null;

  return (
    <Screen>
      <ScreenHeader title={t('Profile')} />
      <ScrollView contentContainerStyle={styles.content}>
        {notice ? <InlineAlert tone="success" message={notice} onDismiss={() => setNotice(null)} testID="profile-notice" /> : null}

        <Card testID="profile-account">
          <View style={styles.row}>
            {profile.data ? <Avatar profile={profile.data} onPress={() => setSheet('photo')} /> : <View style={styles.avatar} />}
            <View style={styles.rowText}>
              <ThemedText type="defaultBold" numberOfLines={1} testID="profile-name" nativeID="profile-name">
                {profile.data?.fullName ?? '…'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1} testID="profile-email" nativeID="profile-email">
                {session?.user.email ?? ''}
              </ThemedText>
            </View>
            {verification ? <Badge label={verification.label} tone={verification.tone} testID="profile-verification" /> : null}
          </View>
          {verification && driver.data?.verificationStatus !== 'VERIFIED' ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.note} testID="profile-verification-message">
              {driver.data?.verificationNote ? `${verification.message} ${driver.data.verificationNote}` : verification.message}
            </ThemedText>
          ) : null}
        </Card>

        <Card testID="profile-details">
          <Row
            icon="phone"
            label={t('Phone')}
            value={profile.data?.phone ? formatPhone(profile.data.phone) : t('Not added')}
            testID="profile-phone"
          />
          {profile.data?.phone ? (
            profile.data.phoneVerifiedAt ? (
              <Badge label={t('Phone verified')} tone="success" testID="profile-phone-status" />
            ) : (
              <AppButton
                testID="profile-verify-phone"
                title={t('Verify phone')}
                icon="phone"
                size="sm"
                onPress={() => setSheet('verify')}
              />
            )
          ) : null}
          <AppButton
            testID="profile-edit-details"
            title={t('Edit name and phone')}
            icon="edit"
            variant="secondary"
            size="sm"
            disabled={!profile.data}
            onPress={() => setSheet('details')}
          />
        </Card>

        <Card testID="profile-vehicle">
          <Row
            icon="delivery"
            label={t('Vehicle')}
            value={
              driver.data
                ? `${driver.data.vehicleType} · ${driver.data.licensePlate}`
                : driver.data === null
                  ? t('Not registered yet. Register it on the Today tab.')
                  : '…'
            }
            testID="profile-vehicle-value"
          />
          {driver.data ? (
            canEditVehicle(driver.data.status) ? (
              <AppButton testID="profile-edit-vehicle" title={t('Change vehicle')} icon="edit" variant="secondary" size="sm" onPress={() => setSheet('vehicle')} />
            ) : (
              <ThemedText type="caption" themeColor="textSecondary" testID="profile-vehicle-locked" nativeID="profile-vehicle-locked">
                {t('Go offline on the Today tab to change your vehicle.')}
              </ThemedText>
            )
          ) : null}
        </Card>

        {rating.data ? (
          <Card testID="profile-rating">
            <ThemedText type="caption" themeColor="textSecondary">
              {t('Rating from customers')}
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
        <Card testID="profile-language">
          <LanguageSwitch />
        </Card>
        <AppButton testID="sign-out" title={t('Sign out')} icon="logout" variant="secondary" onPress={() => setConfirmingSignOut(true)} />
      </ScrollView>

      {sheet === 'photo' && profile.data ? <PhotoSheet profile={profile.data} onClose={() => setSheet(null)} onDone={done} /> : null}
      {sheet === 'details' && profile.data ? <DetailsSheet profile={profile.data} onClose={() => setSheet(null)} onDone={done} /> : null}
      {sheet === 'verify' && profile.data?.phone ? (
        <PhoneVerificationSheet phone={profile.data.phone} onClose={() => setSheet(null)} onVerified={() => done(t('Phone verified.'))} />
      ) : null}
      {sheet === 'vehicle' && driver.data ? <VehicleSheet driver={driver.data} onClose={() => setSheet(null)} onDone={done} /> : null}

      <Dialog
        visible={confirmingSignOut}
        title={t('Sign out?')}
        message={t('You can sign back in at any time.')}
        confirmLabel={t('Sign out')}
        destructive
        onConfirm={() => {
          setConfirmingSignOut(false);
          void signOut();
        }}
        onCancel={() => setConfirmingSignOut(false)}
        testID="sign-out-dialog"
      />
    </Screen>
  );
}

function errorMessage(caught: unknown): string {
  return caught instanceof ApiError || caught instanceof Error ? caught.message : t('That did not go through. Try again.');
}

/** Photo: customers see it on the driver card once a delivery is assigned. */
function PhotoSheet({ profile, onClose, onDone }: { profile: UserProfile; onClose: () => void; onDone: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>, message: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      if (result !== null) onDone(message);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible title={t('Profile photo')} onClose={onClose} testID="photo-sheet">
      <ThemedText type="small" themeColor="textSecondary">
        {t('Customers see your photo with your first name and vehicle when you deliver their order.')}
      </ThemedText>
      {error ? <InlineAlert message={error} testID="photo-error" /> : null}
      <AppButton testID="photo-library" title={t('Choose from library')} icon="person" loading={busy} onPress={() => void run(() => changeMyAvatar('library'), 'Photo updated.')} />
      {Platform.OS !== 'web' ? (
        <AppButton testID="photo-camera" title={t('Take a photo')} variant="secondary" disabled={busy} onPress={() => void run(() => changeMyAvatar('camera'), 'Photo updated.')} />
      ) : null}
      {profile.avatarUrl ? (
        <AppButton testID="photo-remove" title={t('Remove photo')} variant="danger" disabled={busy} onPress={() => void run(() => removeMyPhoto(), 'Photo removed.')} />
      ) : null}
    </Sheet>
  );
}

function DetailsSheet({ profile, onClose, onDone }: { profile: UserProfile; onClose: () => void; onDone: (message: string) => void }) {
  const [fullName, setFullName] = useState(profile.fullName);
  const [phone, setPhone] = useState(profile.phone ? formatPhone(profile.phone) : '');
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problems = detailsProblems(fullName, phone);

  async function save() {
    setSubmitted(true);
    if (busy || problems.fullName || problems.phone) return;
    setBusy(true);
    setError(null);
    try {
      // The backend normalizes too (#152); a blank phone removes it.
      await saveMyProfile({ fullName: fullName.trim(), phone: phone.trim() ? (normalizeEgyptianMobile(phone) ?? phone) : '' });
      onDone(t('Details saved.'));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible title={t('Name and phone')} onClose={onClose} testID="details-sheet">
      <FormTextInput
        testID="details-name"
        label={t('Full name')}
        value={fullName}
        onChangeText={setFullName}
        autoComplete="name"
        error={submitted ? problems.fullName : undefined}
      />
      <FormTextInput
        testID="details-phone"
        label={t('Mobile number')}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoComplete="tel"
        hint={t(PHONE_HINT)}
        error={submitted ? problems.phone : undefined}
      />
      <ThemedText type="caption" themeColor="textSecondary">
        {t('Customers only see your first name. Your full name and phone stay private.')}
      </ThemedText>
      {error ? <InlineAlert message={error} testID="details-error" /> : null}
      <AppButton testID="details-save" title={t('Save')} loading={busy} onPress={() => void save()} />
    </Sheet>
  );
}

function VehicleSheet({ driver, onClose, onDone }: { driver: Driver; onClose: () => void; onDone: (message: string) => void }) {
  const [vehicleType, setVehicleType] = useState(driver.vehicleType);
  const [licensePlate, setLicensePlate] = useState(driver.licensePlate);
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problems = vehicleProblems(vehicleType, licensePlate);

  async function save() {
    setSubmitted(true);
    if (busy || problems.vehicleType || problems.licensePlate) return;
    setBusy(true);
    setError(null);
    try {
      await updateMyVehicle({ vehicleType: vehicleType.trim(), licensePlate: licensePlate.trim() });
      onDone(t('Vehicle saved.'));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet visible title={t('Your vehicle')} onClose={onClose} testID="vehicle-sheet">
      <FormTextInput
        testID="vehicle-type"
        label={t('Vehicle type')}
        value={vehicleType}
        onChangeText={setVehicleType}
        maxLength={60}
        error={submitted ? problems.vehicleType : undefined}
      />
      <FormTextInput
        testID="vehicle-plate"
        label={t('License plate')}
        value={licensePlate}
        onChangeText={setLicensePlate}
        autoCapitalize="characters"
        maxLength={30}
        error={submitted ? problems.licensePlate : undefined}
      />
      <ThemedText type="caption" themeColor="textSecondary">
        {t('Customers see your vehicle and plate so they can find you.')}
      </ThemedText>
      {error ? <InlineAlert message={error} testID="vehicle-error" /> : null}
      <AppButton testID="vehicle-save" title={t('Save vehicle')} loading={busy} onPress={() => void save()} />
    </Sheet>
  );
}

function Avatar({ profile, onPress }: { profile: UserProfile; onPress: () => void }) {
  const initials = profile.fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <Pressable
      style={styles.avatar}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={profile.avatarUrl ? t('Change or remove your photo') : t('Add a profile photo')}
      testID="profile-avatar"
      nativeID="profile-avatar">
      {profile.avatarUrl ? (
        <View style={styles.avatarImage} testID="profile-avatar-image" nativeID="profile-avatar-image">
          <Image source={profile.avatarUrl} style={styles.avatarImage} contentFit="cover" cachePolicy="memory-disk" />
        </View>
      ) : (
        <ThemedText type="defaultBold" style={styles.avatarText} testID="profile-avatar-initials" nativeID="profile-avatar-initials">
          {initials || '?'}
        </ThemedText>
      )}
    </Pressable>
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
  note: {
    marginTop: Spacing.two,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
    backgroundColor: BrandColors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarText: {
    color: BrandColors.primaryText,
  },
  comment: {
    gap: Spacing.half,
    marginTop: Spacing.two,
  },
  commentStars: {
    color: BrandColors.primaryText,
  },
});
