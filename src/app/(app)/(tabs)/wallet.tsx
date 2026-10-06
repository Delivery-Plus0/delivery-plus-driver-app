import { Screen, ScreenHeader } from '@/components/ui/screen';
import { StateView } from '@/components/ui/state-view';

/**
 * Placeholder until earnings exist on the backend (#145/#146). Amounts are never computed or shown
 * by the app itself: money only appears here once the backend calculates it.
 */
export default function WalletScreen() {
  return (
    <Screen>
      <ScreenHeader title="Wallet" />
      <StateView
        icon="wallet"
        title="Earnings are coming soon"
        message="Earnings and payouts are not available in the app yet. They will appear here once Delivery Plus calculates them."
        testID="wallet-coming-soon"
      />
    </Screen>
  );
}
