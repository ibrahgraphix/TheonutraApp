import { Image } from 'expo-image';
import { StyleSheet, View, type ViewStyle } from 'react-native';

interface LogoHeaderProps {
  height?: number;
  style?: ViewStyle;
}

export function LogoHeader({ height = 72, style }: LogoHeaderProps) {
  return (
    <View style={[styles.container, style]}>
      <Image
        accessibilityLabel="Theonutra logo"
        contentFit="contain"
        source={require('../../assets/logo.png')}
        style={{ width: '100%', height }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
});
