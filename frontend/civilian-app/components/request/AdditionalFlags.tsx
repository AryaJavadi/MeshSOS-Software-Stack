import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, radius, spacing } from '@/constants/design';

interface AdditionalFlagsProps {
  medicalAttentionNeeded: boolean;
  cannotMove: boolean;
  onToggleMedical: () => void;
  onToggleCannotMove: () => void;
}

interface CheckRowProps {
  checked: boolean;
  label: string;
  description: string;
  onToggle: () => void;
  accentColor?: string;
}

function CheckRow({ checked, label, description, onToggle, accentColor = colors.red }: CheckRowProps) {
  return (
    <TouchableOpacity style={styles.row} onPress={onToggle} activeOpacity={0.7}>
      <View style={[styles.checkbox, checked && { backgroundColor: accentColor, borderColor: accentColor }]}>
        {checked && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <View style={styles.textWrap}>
        <Text style={[styles.label, checked && { color: accentColor }]}>{label}</Text>
        <Text style={styles.desc}>{description}</Text>
      </View>
    </TouchableOpacity>
  );
}

export function AdditionalFlags({
  medicalAttentionNeeded,
  cannotMove,
  onToggleMedical,
  onToggleCannotMove,
}: AdditionalFlagsProps) {
  return (
    <View style={styles.container}>
      <CheckRow
        checked={medicalAttentionNeeded}
        label="Someone needs urgent medical attention"
        description="Auto-upgrades urgency and flags for medical responders"
        onToggle={onToggleMedical}
        accentColor={colors.red}
      />
      <View style={styles.divider} />
      <CheckRow
        checked={cannotMove}
        label="We cannot move / are trapped"
        description="Signals responders to send a rescue team, not just supplies"
        onToggle={onToggleCannotMove}
        accentColor={colors.yellow}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  checkmark: {
    fontSize: 11,
    fontWeight: '700',
    color: 'white',
  },
  textWrap: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    fontFamily: 'DM Sans',
    lineHeight: 17,
  },
  desc: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
    fontFamily: 'DM Sans',
    lineHeight: 15,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
});
