import React, { useMemo } from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { radius } from '@/constants/design';
import { useTheme } from '@/hooks/useTheme';
import { ThemeColors } from '@/constants/themes';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  borderColor?: string;
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
    },
  });
}

export function Card({ children, style, borderColor }: CardProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={[styles.card, borderColor ? { borderColor } : undefined, style]}>
      {children}
    </View>
  );
}