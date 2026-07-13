export const colors = {
  primary: '#1A5E3A',
  primaryDark: '#0F4D2E',
  primaryLight: '#2D7A52',
  secondary: '#C5A059',
  secondaryDark: '#A8843F',
  secondaryLight: '#D4B87A',

  background: '#F8F9FA',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F3F5',

  text: '#1A1A1A',
  textSecondary: '#6B7280',
  textInverse: '#FFFFFF',
  textOnPrimary: '#FFFFFF',
  textOnSecondary: '#1A1A1A',

  border: '#E5E7EB',
  borderLight: '#F3F4F6',

  success: '#16A34A',
  warning: '#D97706',
  error: '#DC2626',
  info: '#2563EB',

  tabBar: '#FFFFFF',
  tabBarBorder: '#E5E7EB',
  tabInactive: '#9CA3AF',
  tabActive: '#1A5E3A',

  overlay: 'rgba(0, 0, 0, 0.45)',
} as const;

export type Colors = typeof colors;
