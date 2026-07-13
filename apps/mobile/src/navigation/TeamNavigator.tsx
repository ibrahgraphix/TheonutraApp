import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { TeamListScreen } from '../screens/team/TeamListScreen';
import { TeamMemberScreen } from '../screens/team/TeamMemberScreen';
import type { TeamStackParamList } from './teamTypes';

const Stack = createNativeStackNavigator<TeamStackParamList>();

export function TeamNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TeamList" component={TeamListScreen} />
      <Stack.Screen name="TeamMember" component={TeamMemberScreen} />
    </Stack.Navigator>
  );
}
