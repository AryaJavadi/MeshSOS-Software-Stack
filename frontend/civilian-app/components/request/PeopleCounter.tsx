import React, { useMemo } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { radius } from '@/constants/design';
import { PeopleCount } from '@/types';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { useTheme } from '@/hooks/useTheme';
import { ThemeColors } from '@/constants/themes';

interface PeopleCounterProps {
  value: PeopleCount;
  onChange: (count: PeopleCount) => void;
}

interface CounterFieldProps {
  label: string;
  subLabel: string;
  value: number;
  onChange: (v: number) => void;
  styles: ReturnType<typeof makeStyles>;
  textMuted: string;
}

function CounterField({ label, subLabel, value, onChange, styles, textMuted }: CounterFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldSubLabel}>{subLabel}</Text>
      <TextInput
        style={styles.input}
        value={value === 0 ? '' : String(value)}
        onChangeText={(t) => {
          const n = parseInt(t, 10);
          onChange(isNaN(n) || n < 0 ? 0 : n);
        }}
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor={textMuted}
        maxLength={3}
      />
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { gap: 6 },
    row: { flexDirection: 'row', gap: 8 },
    field: { flex: 1 },
    fieldLabel: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.4,
      color: colors.textMuted,
      textTransform: 'uppercase',
      marginBottom: 1,
      fontFamily: 'DM Sans',
    },
    fieldSubLabel: {
      fontSize: 10,
      color: colors.textMuted,
      fontFamily: 'DM Sans',
      marginBottom: 4,
      opacity: 0.7,
    },
    input: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.sm,
      paddingVertical: 11,
      paddingHorizontal: 14,
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      fontFamily: 'DM Mono',
    },
  });
}

export function PeopleCounter({ value, onChange }: PeopleCounterProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <SectionLabel>People to provide for</SectionLabel>
      <View style={styles.row}>
        <CounterField
          label="INFANT"
          subLabel="(0–2)"
          value={value.adults}
          onChange={(v) => onChange({ ...value, adults: v })}
          styles={styles}
          textMuted={colors.textMuted}
        />
        <CounterField
          label="CHILD/ADULT"
          subLabel="(3–59)"
          value={value.children}
          onChange={(v) => onChange({ ...value, children: v })}
          styles={styles}
          textMuted={colors.textMuted}
        />
        <CounterField
          label="SENIOR"
          subLabel="(60+)"
          value={value.elderly}
          onChange={(v) => onChange({ ...value, elderly: v })}
          styles={styles}
          textMuted={colors.textMuted}
        />
      </View>
    </View>
  );
}