import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AddCountryScreen } from '../screens/manage/AddCountryScreen';
import { AddEditProductScreen } from '../screens/manage/AddEditProductScreen';
import { AddSellerScreen } from '../screens/manage/AddSellerScreen';
import { CountryListScreen } from '../screens/manage/CountryListScreen';
import { DistributorDetailScreen } from '../screens/manage/DistributorDetailScreen';
import { DistributorListScreen } from '../screens/manage/DistributorListScreen';
import { ManageHomeScreen } from '../screens/manage/ManageHomeScreen';
import { PendingPaymentsScreen } from '../screens/manage/PendingPaymentsScreen';
import { PostNewsScreen } from '../screens/manage/PostNewsScreen';
import { ResetPasswordScreen } from '../screens/manage/ResetPasswordScreen';
import type { ManageStackParamList } from './manageTypes';

const Stack = createNativeStackNavigator<ManageStackParamList>();

export function ManageNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ManageHome" component={ManageHomeScreen} />
      <Stack.Screen name="DistributorList" component={DistributorListScreen} />
      <Stack.Screen name="DistributorDetail" component={DistributorDetailScreen} />
      <Stack.Screen name="AddSeller" component={AddSellerScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <Stack.Screen name="CountryList" component={CountryListScreen} />
      <Stack.Screen name="AddCountry" component={AddCountryScreen} />
      <Stack.Screen name="AddEditProduct" component={AddEditProductScreen} />
      <Stack.Screen name="PostNews" component={PostNewsScreen} />
      <Stack.Screen name="PendingPayments" component={PendingPaymentsScreen} />
    </Stack.Navigator>
  );
}