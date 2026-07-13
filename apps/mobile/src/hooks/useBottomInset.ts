import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing } from '../theme';

export function useBottomInset(min = spacing.sm) {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, min);
}
