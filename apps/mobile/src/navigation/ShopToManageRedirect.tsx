import { useEffect } from 'react';
import { View } from 'react-native';
import { CommonActions, useNavigation } from '@react-navigation/native';

/**
 * Placeholder screen mounted at the "Shop" tab for admin/company_staff.
 * Staff can't buy from themselves, so instead of showing the distributor
 * buy-flow, this immediately redirects into Manage → ProductList the
 * moment the Shop tab gains focus, then leaves the Manage tab focused.
 */
export function ShopToManageRedirect() {
  const navigation = useNavigation();

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Jump to the Manage tab's ProductList screen, then immediately
      // switch the active tab to Manage so the tab bar reflects reality
      // and the user isn't left looking at a blank Shop tab.
      navigation.getParent()?.dispatch(
        CommonActions.navigate('Manage', { screen: 'ProductList' }),
      );
    });

    return unsubscribe;
  }, [navigation]);

  return <View />;
}