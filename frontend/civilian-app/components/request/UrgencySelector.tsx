import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, radius, spacing } from '@/constants/design';
import { UrgencyLevel } from '@/types';
import { SectionLabel } from '@/components/ui/SectionLabel';

const OPTIONS: { level: UrgencyLevel; label: string; color: string; dimColor: string; borderColor: string }[] = [
  { level: 'low', label: 'Low', color: colors.green, dimColor: colors.greenDim, borderColor: colors.greenBorder },
  { level: 'medium', label: 'Medium', color: colors.yellow, dimColor: colors.yellowDim, borderColor: colors.yellowBorder },
  { level: 'high', label: '🚨 High', color: colors.red, dimColor: colors.redDim, borderColor: colors.redBorder },
];

interface UrgencySelectorProps {
  value: UrgencyLevel | null;
  onChange: (level: UrgencyLevel) => void;
}

export function UrgencySelector({ value, onChange }: UrgencySelectorProps) {
  return (
    <View style={styles.container}>
      <SectionLabel>Urgency Level</SectionLabel>
      <View style={styles.row}>
        {OPTIONS.map((opt) => {
          const isSelected = value === opt.level;
          return (
            <TouchableOpacity
              key={opt.level}
              style={[
                styles.option,
                isSelected && {
                  backgroundColor: opt.dimColor,
                  borderColor: opt.borderColor,
                },
              ]}
              onPress={() => onChange(opt.level)}
              activeOpacity={0.7}
            >
              <Text style={[styles.optionText, isSelected && { color: opt.color }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    gap: 6,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: colors.textMuted,
    fontFamily: 'DM Sans',
  },
});
