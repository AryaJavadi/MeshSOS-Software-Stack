import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '@/constants/design';

interface FormProgressProps {
  totalSteps: number;
  currentStep: number; // 0-indexed
}

export function FormProgress({ totalSteps, currentStep }: FormProgressProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: totalSteps }, (_, i) => (
        <View
          key={i}
          style={[
            styles.step,
            i < currentStep && styles.done,
            i === currentStep && styles.active,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  step: {
    flex: 1,
    height: 3,
    borderRadius: radius.full,
    backgroundColor: colors.border,
  },
  done: {
    backgroundColor: colors.accent,
  },
  active: {
    backgroundColor: colors.accent,
    opacity: 0.5,
  },
});
