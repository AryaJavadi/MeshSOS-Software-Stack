import React, { useEffect, useRef, useMemo } from 'react';
import { View, Text, ScrollView, SafeAreaView, StyleSheet, Animated } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useMessageStore } from '@/store/messageStore';
import { radius, spacing } from '@/constants/design';
import { GatewayMessage, GatewayMessageType } from '@/types';
import { useTheme } from '@/hooks/useTheme';
import { ThemeColors } from '@/constants/themes';

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    header: { padding: spacing.lg, paddingBottom: spacing.sm },
    title: {
      fontSize: 26,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.4,
      fontFamily: 'DM Sans',
    },
    subtitle: {
      fontSize: 14,
      color: colors.textMuted,
      marginTop: 2,
      fontFamily: 'DM Sans',
    },
    syncBar: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.md,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    syncText: {
      fontSize: 12,
      color: colors.textMuted,
      fontFamily: 'DM Mono',
      flex: 1,
    },
    syncDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.green,
      marginLeft: 8,
    },
    scroll: { flex: 1 },
    card: {
      marginHorizontal: spacing.lg,
      marginBottom: 40,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      overflow: 'hidden',
    },
    msgRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    msgRowRead: { opacity: 0.7 },
    leftBar: { width: 3, flexShrink: 0 },
    msgContent: { flex: 1, padding: 11, gap: 5 },
    msgTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    senderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flex: 1,
      flexWrap: 'wrap',
    },
    sender: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      fontFamily: 'DM Sans',
    },
    badge: {
      borderWidth: 1,
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 1.5,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      fontFamily: 'DM Sans',
    },
    time: {
      fontSize: 11,
      color: colors.textMuted,
      fontFamily: 'DM Mono',
      flexShrink: 0,
      marginLeft: 4,
    },
    content: {
      fontSize: 15,
      color: colors.text,
      lineHeight: 22,
      fontFamily: 'DM Sans',
    },
    unreadDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.accent,
      marginTop: 14,
      marginRight: 10,
      flexShrink: 0,
    },
    unreadDotSpacer: { width: 7, marginRight: 10, flexShrink: 0 },
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
      gap: 12,
    },
    emptyEmoji: { fontSize: 48, opacity: 0.4 },
    emptyTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
      fontFamily: 'DM Sans',
    },
    emptyDesc: {
      fontSize: 15,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 22,
      fontFamily: 'DM Sans',
    },
  });
}

// ─── Animated sync dot ────────────────────────────────────────────────────────

function PulseDot({ dotStyle }: { dotStyle: object }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return <Animated.View style={[dotStyle, { opacity }]} />;
}

// ─── Message row ─────────────────────────────────────────────────────────────

function MessageCard({ message, styles, colors }: {
  message: GatewayMessage;
  styles: ReturnType<typeof makeStyles>;
  colors: ThemeColors;
}) {
  const TYPE_COLOR: Record<GatewayMessageType, string> = {
    info: colors.blue, action: colors.yellow, urgent: colors.red,
  };
  const TYPE_DIM: Record<GatewayMessageType, string> = {
    info: colors.blueDim, action: colors.yellowDim, urgent: colors.redDim,
  };
  const TYPE_BORDER: Record<GatewayMessageType, string> = {
    info: colors.blueBorder, action: colors.yellowBorder, urgent: colors.redBorder,
  };
  const TYPE_LABEL: Record<GatewayMessageType, string> = {
    info: 'Info', action: 'Action', urgent: 'Urgent',
  };

  const color  = TYPE_COLOR[message.type];
  const dim    = TYPE_DIM[message.type];
  const border = TYPE_BORDER[message.type];
  const isRead = message.read === true;

  return (
    <View style={[styles.msgRow, isRead && styles.msgRowRead]}>
      <View style={[styles.leftBar, { backgroundColor: color }]} />
      <View style={styles.msgContent}>
        <View style={styles.msgTop}>
          <View style={styles.senderRow}>
            <Text style={styles.sender}>Gateway · {message.fromNodeId}</Text>
            <View style={[styles.badge, { backgroundColor: dim, borderColor: border }]}>
              <Text style={[styles.badgeText, { color }]}>{TYPE_LABEL[message.type]}</Text>
            </View>
          </View>
          <Text style={styles.time}>{formatTime(message.timestamp)}</Text>
        </View>
        <Text style={styles.content}>{message.content}</Text>
      </View>
      {!isRead ? (
        <View style={styles.unreadDot} />
      ) : (
        <View style={styles.unreadDotSpacer} />
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MessagesScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { messages, markAllRead, lastSyncedAt, lastSyncedNodeId } = useMessageStore();

  useFocusEffect(
    React.useCallback(() => {
      markAllRead();
    }, [markAllRead])
  );

  const syncTimeStr = lastSyncedAt
    ? `Last synced via Node ${lastSyncedNodeId ?? '—'} · ${formatTime(lastSyncedAt)}`
    : 'Not yet synced';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Messages</Text>
        <Text style={styles.subtitle}>Updates from first responders</Text>
      </View>

      <View style={styles.syncBar}>
        <Text style={styles.syncText}>{syncTimeStr}</Text>
        <PulseDot dotStyle={styles.syncDot} />
      </View>

      {messages.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>📻</Text>
          <Text style={styles.emptyTitle}>No messages yet</Text>
          <Text style={styles.emptyDesc}>
            Updates from first responders and the gateway will appear here once your request is received.
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            {messages.map((msg) => (
              <MessageCard key={msg.id} message={msg} styles={styles} colors={colors} />
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
