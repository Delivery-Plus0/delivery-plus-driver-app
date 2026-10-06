import { Screen, ScreenHeader } from '@/components/ui/screen';
import { StateView } from '@/components/ui/state-view';

/** Placeholder until the driver history endpoint exists (#142); never shows invented trips. */
export default function HistoryScreen() {
  return (
    <Screen>
      <ScreenHeader title="History" />
      <StateView
        icon="clock"
        title="Trip history is coming soon"
        message="Your completed deliveries will be listed here."
        testID="history-coming-soon"
      />
    </Screen>
  );
}
