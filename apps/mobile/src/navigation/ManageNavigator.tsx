import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { AddArticleScreen } from '../screens/manage/AddArticleScreen';
import { AddCountryScreen } from '../screens/manage/AddCountryScreen';
import { AddEditEventScreen } from '../screens/manage/AddEditEventScreen';
import { AddEditProductScreen } from '../screens/manage/AddEditProductScreen';
import { AddSellerScreen } from '../screens/manage/AddSellerScreen';
import { CountryListScreen } from '../screens/manage/CountryListScreen';
import { DistributorDetailScreen } from '../screens/manage/DistributorDetailScreen';
import { DistributorListScreen } from '../screens/manage/DistributorListScreen';
import { EditArticleScreen } from '../screens/manage/EditArticleScreen';
import { EditCountryScreen } from '../screens/manage/EditCountryScreen';
import { EditNewsScreen } from '../screens/manage/EditNewsScreen';
import { EditSellerScreen } from '../screens/manage/EditSellerScreen';
import { ManageArticlesListScreen } from '../screens/manage/ManageArticlesListScreen';
import { ManageEventsScreen } from '../screens/manage/ManageEventsScreen';
import { ManageHomeScreen } from '../screens/manage/ManageHomeScreen';
import { ManageNewsListScreen } from '../screens/manage/ManageNewsListScreen';
import { ManageTrainingMaterialsScreen } from '../screens/manage/ManageTrainingMaterialsScreen';
import { ManageTrainingScreen } from '../screens/manage/ManageTrainingScreen';
import { PendingPaymentsScreen } from '../screens/manage/PendingPaymentsScreen';
import { PostNewsScreen } from '../screens/manage/PostNewsScreen';
import { ProductListScreen } from '../screens/manage/ProductListScreen';
import { ResetPasswordScreen } from '../screens/manage/ResetPasswordScreen';
import type { ManageStackParamList } from './manageTypes';
import { ManageKycScreen } from '../screens/manage/ManageKycScreen';
import { CompanyAnalyticsScreen } from '../screens/manage/CompanyAnalyticsScreen';

const Stack = createNativeStackNavigator<ManageStackParamList>();

export function ManageNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ManageHome" component={ManageHomeScreen} />
      <Stack.Screen name="DistributorList" component={DistributorListScreen} />
      <Stack.Screen name="DistributorDetail" component={DistributorDetailScreen} />
      <Stack.Screen name="AddSeller" component={AddSellerScreen} />
      <Stack.Screen name="EditSeller" component={EditSellerScreen} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
      <Stack.Screen name="CountryList" component={CountryListScreen} />
      <Stack.Screen name="AddCountry" component={AddCountryScreen} />
      <Stack.Screen name="EditCountry" component={EditCountryScreen} />
      <Stack.Screen name="ProductList" component={ProductListScreen} />
      <Stack.Screen name="AddEditProduct" component={AddEditProductScreen} />
      <Stack.Screen name="PostNews" component={PostNewsScreen} />
      <Stack.Screen name="ManageNews" component={ManageNewsListScreen} />
      <Stack.Screen name="EditNews" component={EditNewsScreen} />
      <Stack.Screen name="AddArticle" component={AddArticleScreen} />
      <Stack.Screen name="ManageArticles" component={ManageArticlesListScreen} />
      <Stack.Screen name="EditArticle" component={EditArticleScreen} />
      <Stack.Screen name="PendingPayments" component={PendingPaymentsScreen} />
      <Stack.Screen name="ManageTraining" component={ManageTrainingScreen} />
      <Stack.Screen name="ManageTrainingMaterials" component={ManageTrainingMaterialsScreen} />
      <Stack.Screen name="ManageEvents" component={ManageEventsScreen} />
      <Stack.Screen name="AddEditEvent" component={AddEditEventScreen} />
      <Stack.Screen name="ManageKyc" component={ManageKycScreen} />
      <Stack.Screen name="CompanyAnalytics" component={CompanyAnalyticsScreen} />
    </Stack.Navigator>
  );
}