import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ArticleDetailScreen } from '../screens/articles/ArticleDetailScreen';
import { ArticlesListScreen } from '../screens/articles/ArticlesListScreen';
import type { ArticlesStackParamList } from './articlesTypes';

const Stack = createNativeStackNavigator<ArticlesStackParamList>();

export function ArticlesNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ArticlesList" component={ArticlesListScreen} />
      <Stack.Screen name="ArticleDetail" component={ArticleDetailScreen} />
    </Stack.Navigator>
  );
}
