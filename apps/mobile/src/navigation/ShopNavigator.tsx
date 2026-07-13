import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { CartScreen } from '../screens/shop/CartScreen';
import { CheckoutScreen } from '../screens/shop/CheckoutScreen';
import { OrderConfirmationScreen } from '../screens/shop/OrderConfirmationScreen';
import { ProductDetailScreen } from '../screens/shop/ProductDetailScreen';
import { ShopListScreen } from '../screens/shop/ShopListScreen';
import type { ShopStackParamList } from './shopTypes';

const Stack = createNativeStackNavigator<ShopStackParamList>();

export function ShopNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ShopList" component={ShopListScreen} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <Stack.Screen name="Cart" component={CartScreen} />
      <Stack.Screen name="Checkout" component={CheckoutScreen} />
      <Stack.Screen name="OrderConfirmation" component={OrderConfirmationScreen} />
    </Stack.Navigator>
  );
}
