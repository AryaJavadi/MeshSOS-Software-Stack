import React, { useMemo } from 'react';
import { View, Text, SafeAreaView, StyleSheet, TouchableOpacity } from 'react-native';
import { useBLEStore } from '@/store/bleStore';
import { bleService } from '@/services/ble';
import { spacing } from '@/constants/design';
import { StatusPill } from '@/components/ui/StatusPill';
import { DisconnectedState } from '@/components/home/DisconnectedState';
import { ConnectedState } from '@/components/home/ConnectedState';
import { useTheme } from '@/hooks/useTheme';
import { ThemeColors } from '@/constants/themes';

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    container: { flex: 1, padding: spacing.lg, gap: spacing.md },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.xs,
    },
    greeting: {
      fontSize: 13,
      fontWeight: '500',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: colors.textMuted,
      fontFamily: 'DM Sans',
    },
    appName: {
      fontSize: 26,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.4,
      fontFamily: 'DM Sans',
      lineHeight: 32,
    },
  });
}

export default function HomeScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { connectionState, connectedNode, scanError } = useBLEStore();

  const isConnected = connectionState === 'connected' && connectedNode;
  const isScanning = connectionState === 'scanning' || connectionState === 'connecting';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Emergency Mode</Text>
            <Text style={styles.appName}>MeshSOS</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              onPress={toggleTheme}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 20,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ fontSize: 14 }}>{isDark ? '☀️' : '🌙'}</Text>
            </TouchableOpacity>

            {isConnected ? (
              <StatusPill
                label="Node Active"
                color={colors.green}
                dimColor={colors.greenDim}
                borderColor={colors.greenBorder}
                pulse
              />
            ) : (
              <StatusPill
                label="No Node"
                color={colors.red}
                dimColor={colors.redDim}
                borderColor={colors.redBorder}
              />
            )}
          </View>
        </View>

        {isConnected ? (
          <ConnectedState node={connectedNode} />
        ) : (
          <DisconnectedState
            isScanning={isScanning}
            scanError={scanError}
            onScan={() => bleService.startScan()}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
