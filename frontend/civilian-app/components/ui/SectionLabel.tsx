import React, { useMemo } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { ThemeColors } from '@/constants/themes';

interface SectionLabelProps {
  children: React.ReactNode;
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    label: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: colors.textMuted,
      fontFamily: 'DM Sans',
      marginBottom: 6,
    },
  });
}

export function SectionLabel({ children }: SectionLabelProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <Text style={styles.label}>{children}</Text>;
}