import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { NewsDetailScreen } from '../screens/news/NewsDetailScreen';
import { NewsListScreen } from '../screens/news/NewsListScreen';
import type { NewsStackParamList } from './newsTypes';

const Stack = createNativeStackNavigator<NewsStackParamList>();

export function NewsNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="NewsList" component={NewsListScreen} />
      <Stack.Screen name="NewsDetail" component={NewsDetailScreen} />
    </Stack.Navigator>
  );
}
