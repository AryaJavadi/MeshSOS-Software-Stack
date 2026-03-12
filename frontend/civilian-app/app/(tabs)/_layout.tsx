import { useMemo } from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { tabBarHeight } from '@/constants/design';
import { useMessageStore } from '@/store/messageStore';
import { useTheme } from '@/hooks/useTheme';
import { ThemeColors } from '@/constants/themes';

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    tabItem: { alignItems: 'center', gap: 3, width: 64 },
    iconBadgeWrap: { position: 'relative' },
    tabIconText: { fontSize: 20, color: colors.textMuted },
    tabIconActive: { color: colors.accent },
    tabLabel: {
      fontSize: 9,
      fontWeight: '600',
      letterSpacing: 0.3,
      color: colors.textMuted,
      textTransform: 'uppercase',
      fontFamily: 'DM Sans',
    },
    tabLabelActive: { color: colors.accent },
    badge: {
      position: 'absolute',
      top: -4,
      right: -8,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: colors.red,
      borderWidth: 1.5,
      borderColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    badgeText: { fontSize: 8, fontWeight: '800', color: 'white', fontFamily: 'DM Mono' },
  });
}

type TabIconProps = { focused: boolean; icon: string; label: string };

function TabIcon({ focused, icon, label }: TabIconProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.tabItem}>
      <Text style={[styles.tabIconText, focused && styles.tabIconActive]}>{icon}</Text>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function MessagesTabIcon({ focused }: { focused: boolean }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { unreadCount } = useMessageStore();

  return (
    <View style={styles.tabItem}>
      <View style={styles.iconBadgeWrap}>
        <Text style={[styles.tabIconText, focused && styles.tabIconActive]}>⊟</Text>
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]} numberOfLines={1}>
        Messages
      </Text>
    </View>
  );
}

export default function TabLayout() {
  const { colors } = useTheme();
  const tabBarStyle = useMemo(() => ({
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: tabBarHeight,
    paddingBottom: Platform.OS === 'ios' ? 16 : 8,
    paddingTop: 8,
  }), [colors]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="⌂" label="Home" />,
        }}
      />
      <Tabs.Screen
        name="network"
        options={{
          title: 'Network',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="⊙" label="Network" />,
        }}
      />
      <Tabs.Screen
        name="request"
        options={{
          title: 'Request',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="⊕" label="Request" />,
        }}
      />
      <Tabs.Screen
        name="status"
        options={{
          title: 'Messages',
          tabBarIcon: ({ focused }) => <MessagesTabIcon focused={focused} />,
        }}
      />
    </Tabs>
  );
}
