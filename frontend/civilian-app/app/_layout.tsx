import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts, DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import { DMMono_400Regular, DMMono_500Medium } from '@expo-google-fonts/dm-mono';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { bleService } from '@/services/ble';
import { useTheme } from '@/hooks/useTheme';
import { useBroadcastPolling } from '@/hooks/useBroadcastPolling';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useBroadcastPolling();
  const [fontsLoaded] = useFonts({
    'DM Sans': DMSans_400Regular,
    'DM Sans Medium': DMSans_500Medium,
    'DM Sans SemiBold': DMSans_600SemiBold,
    'DM Sans Bold': DMSans_700Bold,
    'DM Mono': DMMono_400Regular,
    'DM Mono Medium': DMMono_500Medium,
  });

  const { colors, isDark } = useTheme();

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
      bleService.initialize();
    }
    return () => {
      bleService.destroy();
    };
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </GestureHandlerRootView>
  );
}
