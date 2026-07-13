import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';

import { useAuthStore } from '../store/authStore';
import { ArticlesNavigator } from './ArticlesNavigator';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';
import { NewsNavigator } from './NewsNavigator';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <>
            <Stack.Screen name="Main" component={MainNavigator} />
            <Stack.Screen name="News" component={NewsNavigator} />
            <Stack.Screen name="Articles" component={ArticlesNavigator} />
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
