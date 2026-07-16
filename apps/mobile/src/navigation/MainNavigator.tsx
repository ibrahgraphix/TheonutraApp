import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AccountScreen } from '../screens/account/AccountScreen';
import { HomeScreen } from '../screens/home/HomeScreen';
import { useAuthStore } from '../store/authStore';
import { colors, spacing, typography } from '../theme';
import { ManageNavigator } from './ManageNavigator';
import { ShopNavigator } from './ShopNavigator';
import { TeamNavigator } from './TeamNavigator';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_BAR_CONTENT_HEIGHT = 56;

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = {
    Home: '🏠',
    Shop: '🛒',
    Team: '👥',
    Account: '👤',
    Manage: '⚙️',
  };

  return (
    <Text style={[styles.icon, focused && styles.iconFocused]}>{icons[label] ?? '•'}</Text>
  );
}

export function MainNavigator() {
  const insets = useSafeAreaInsets();
  const distributor = useAuthStore((s) => s.distributor);
  const isStaff =
    distributor?.role === 'admin' || distributor?.role === 'company_staff';

  // Staff manage the org through Manage → Distributors (tap a distributor to
  // see their chain) instead of a standalone "My Team" tab — that view only
  // makes sense for a regular seller looking at their own downline.
  const showManage = isStaff;
  const showTeam = !isStaff;

  const bottomInset = Math.max(insets.bottom, spacing.sm);

  return (
    <Tab.Navigator
      key={[showTeam, showManage].join('-')}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: 1,
          paddingTop: spacing.sm,
          paddingBottom: bottomInset,
          height: TAB_BAR_CONTENT_HEIGHT + bottomInset,
        },
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused }) => <TabIcon focused={focused} label={route.name} />,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Shop" component={ShopNavigator} />
      {showTeam ? <Tab.Screen name="Team" component={TeamNavigator} /> : null}
      <Tab.Screen name="Account" component={AccountScreen} />
      {showManage ? (
        <Tab.Screen name="Manage" component={ManageNavigator} />
      ) : null}
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabLabel: {
    ...typography.caption,
    fontWeight: '600',
    marginBottom: 2,
  },
  icon: {
    fontSize: 20,
    opacity: 0.6,
  },
  iconFocused: {
    opacity: 1,
  },
});