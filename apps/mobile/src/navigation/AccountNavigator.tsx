import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AccountScreen } from '../screens/account/AccountScreen';
import { EventsScreen } from '../screens/account/EventsScreen';
import { KycVerificationScreen } from '../screens/account/KycVerificationScreen';
import { NotificationsScreen } from '../screens/account/NotificationsScreen';
import { TrainingAcademyScreen } from '../screens/account/TrainingAcademyScreen';
import { TrainingMaterialsScreen } from '../screens/account/TrainingMaterialsScreen';
import { WalletScreen } from '../screens/account/WalletScreen';
import { ReferralScreen } from '../screens/account/ReferralScreen';
import { LoyaltyScreen } from '../screens/account/LoyaltyScreen';
import { CustomerSalesScreen } from '../screens/account/CustomerSalesScreen';
import { SettingsScreen } from '../screens/account/SettingsScreen';
import type { AccountStackParamList } from './accountTypes';

const Stack = createNativeStackNavigator<AccountStackParamList>();

export function AccountNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AccountHome" component={AccountScreen} />
      <Stack.Screen name="Wallet" component={WalletScreen} />
      <Stack.Screen name="KycVerification" component={KycVerificationScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="TrainingAcademy" component={TrainingAcademyScreen} />
      <Stack.Screen name="TrainingMaterials" component={TrainingMaterialsScreen} />
      <Stack.Screen name="Events" component={EventsScreen} />
      <Stack.Screen name="Referral" component={ReferralScreen} />
      <Stack.Screen name="Loyalty" component={LoyaltyScreen} />
      <Stack.Screen name="CustomerSales" component={CustomerSalesScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
}