import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AccountNavigator } from './AccountNavigator';
import { HomeScreen } from '../screens/home/HomeScreen';
import { useAuthStore } from '../store/authStore';
import { colors, spacing, typography } from '../theme';
import { ManageNavigator } from './ManageNavigator';
import { ShopNavigator } from './ShopNavigator';
import { TeamNavigator } from './TeamNavigator';
import type { MainTabParamList } from './types';
import { getNotificationUnreadCount } from '../services/api';

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_BAR_CONTENT_HEIGHT = 56;

function TabIcon({
  label,
  focused,
  badge,
}: {
  label: string;
  focused: boolean;
  badge?: number;
}) {
  const icons: Record<string, string> = {
    Home: '🏠',
    Shop: '🛒',
    Team: '👥',
    Account: '👤',
    Manage: '⚙️',
  };

  return (
    <View>
      <Text style={[styles.icon, focused && styles.iconFocused]}>{icons[label] ?? '•'}</Text>
      {badge != null && badge > 0 ? (
        <View style={styles.notifBadge}>
          <Text style={styles.notifBadgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
    </View>
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
  // Staff can't buy from themselves, so the Shop tab is hidden entirely for
  // admin/company_staff — everything shop-related is under Manage → Products.
  const showShop = !isStaff;

  const bottomInset = Math.max(insets.bottom, spacing.sm);

  const [unreadCount, setUnreadCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchUnread = async () => {
    try {
      const { count } = await getNotificationUnreadCount();
      setUnreadCount(count ?? 0);
    } catch {
      // silently ignore — not logged-in yet or endpoint unavailable
    }
  };

  useEffect(() => {
    void fetchUnread();
    intervalRef.current = setInterval(() => void fetchUnread(), 60_000);

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void fetchUnread();
    });

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      sub.remove();
    };
  }, []);

  return (
    <Tab.Navigator
      key={[showTeam, showManage, showShop].join('-')}
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
        tabBarIcon: ({ focused }) => (
          <TabIcon
            focused={focused}
            label={route.name}
            badge={route.name === 'Account' ? unreadCount : undefined}
          />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      {showShop ? <Tab.Screen name="Shop" component={ShopNavigator} /> : null}
      {showTeam ? <Tab.Screen name="Team" component={TeamNavigator} /> : null}
      <Tab.Screen name="Account" component={AccountNavigator} />
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
  notifBadge: {
    alignItems: 'center',
    backgroundColor: colors.error,
    borderRadius: 8,
    height: 16,
    justifyContent: 'center',
    minWidth: 16,
    paddingHorizontal: 3,
    position: 'absolute',
    right: -8,
    top: -4,
  },
  notifBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
});