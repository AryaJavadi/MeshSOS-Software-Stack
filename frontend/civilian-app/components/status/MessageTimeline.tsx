import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { radius, spacing } from '@/constants/design';
import { SupplyRequest, RequestStatus } from '@/types';
import { useTheme } from '@/hooks/useTheme';
import { ThemeColors } from '@/constants/themes';

interface MessageTimelineProps {
  request: SupplyRequest;
}

interface TimelineStep {
  key: RequestStatus;
  label: string;
  icon: string;
}

const STEPS: TimelineStep[] = [
  { key: 'sent', label: 'Sent', icon: '✓' },
  { key: 'relayed', label: 'Relayed', icon: '✓' },
  { key: 'received', label: 'Received by Gateway', icon: '✓' },
];

const STATUS_ORDER: RequestStatus[] = ['pending', 'sent', 'relayed', 'received', 'failed'];

function getStepState(step: TimelineStep, request: SupplyRequest): 'done' | 'active' | 'pending' {
  const statusIdx = STATUS_ORDER.indexOf(request.status);
  const stepIdx = STATUS_ORDER.indexOf(step.key);

  if (request.status === 'failed') {
    if (step.key === 'sent') return 'active';
    return 'pending';
  }

  if (statusIdx > stepIdx) return 'done';
  if (statusIdx === stepIdx) return 'active';
  return 'pending';
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { paddingVertical: spacing.xs },
    pendingWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: spacing.sm,
    },
    pendingText: {
      fontSize: 14,
      color: colors.textMuted,
      fontFamily: 'DM Sans',
    },
    stepRow: { flexDirection: 'row', gap: spacing.md, minHeight: 36 },
    iconCol: { alignItems: 'center', width: 24 },
    dot: {
      width: 24,
      height: 24,
      borderRadius: radius.full,
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    dotDone: { backgroundColor: colors.green, borderColor: colors.green },
    dotActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    dotFailed: { backgroundColor: colors.red, borderColor: colors.red },
    dotEmpty: {
      width: 8,
      height: 8,
      borderRadius: radius.full,
      backgroundColor: colors.border,
    },
    dotIcon: { fontSize: 11, fontWeight: '700', color: 'white' },
    line: {
      width: 1.5,
      flex: 1,
      backgroundColor: colors.border,
      marginVertical: 2,
    },
    lineDone: { backgroundColor: colors.green },
    textCol: { flex: 1, paddingTop: 3, paddingBottom: 12 },
    stepLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.textMuted,
      fontFamily: 'DM Sans',
    },
    stepLabelDone: { color: colors.text },
    stepLabelPending: { color: colors.textMuted, opacity: 0.5 },
    timestamp: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
      fontFamily: 'DM Mono',
    },
    failedLabel: {
      fontSize: 12,
      color: colors.red,
      marginTop: 2,
      fontFamily: 'DM Sans',
    },
  });
}

export function MessageTimeline({ request }: MessageTimelineProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isPending = request.status === 'pending';
  const isFailed = request.status === 'failed';

  if (isPending) {
    return (
      <View style={styles.pendingWrap}>
        <ActivityIndicator size="small" color={colors.accent} />
        <Text style={styles.pendingText}>
          Queued — will send when node is connected
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {STEPS.map((step, i) => {
        const state = getStepState(step, request);
        const isLast = i === STEPS.length - 1;

        return (
          <View key={step.key} style={styles.stepRow}>
            <View style={styles.iconCol}>
              <View
                style={[
                  styles.dot,
                  state === 'done' && styles.dotDone,
                  state === 'active' && (isFailed ? styles.dotFailed : styles.dotActive),
                ]}
              >
                {state === 'done' ? (
                  <Text style={styles.dotIcon}>✓</Text>
                ) : state === 'active' && !isFailed ? (
                  <ActivityIndicator size="small" color="white" style={{ transform: [{ scale: 0.6 }] }} />
                ) : (
                  <View style={styles.dotEmpty} />
                )}
              </View>
              {!isLast && (
                <View style={[styles.line, state === 'done' && styles.lineDone]} />
              )}
            </View>

            <View style={styles.textCol}>
              <Text style={[
                styles.stepLabel,
                state === 'done' && styles.stepLabelDone,
                state === 'pending' && styles.stepLabelPending,
              ]}>
                {step.label}
                {step.key === 'relayed' && request.relayNodeId
                  ? ` by Node ${request.relayNodeId}`
                  : ''}
              </Text>
              {state === 'done' && step.key === 'sent' && request.sentAt && (
                <Text style={styles.timestamp}>{new Date(request.sentAt).toLocaleTimeString()}</Text>
              )}
              {state === 'done' && step.key === 'relayed' && request.relayedAt && (
                <Text style={styles.timestamp}>{new Date(request.relayedAt).toLocaleTimeString()}</Text>
              )}
              {state === 'done' && step.key === 'received' && request.receivedAt && (
                <Text style={styles.timestamp}>{new Date(request.receivedAt).toLocaleTimeString()}</Text>
              )}
              {isFailed && step.key === 'sent' && (
                <Text style={styles.failedLabel}>Failed · {request.retryCount} attempt{request.retryCount !== 1 ? 's' : ''}</Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}