import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { radius } from '@/constants/design';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { getCurrentLocation, formatCoordinates } from '@/services/location';
import { useTheme } from '@/hooks/useTheme';
import { ThemeColors } from '@/constants/themes';

interface LocationFieldProps {
  latitude: number | null;
  longitude: number | null;
  onLocationCaptured: (lat: number, lon: number) => void;
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { gap: 6 },
    hint: {
      fontWeight: '400',
      textTransform: 'none',
      letterSpacing: 0,
      fontSize: 12,
      color: colors.textMuted,
    },
    field: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.sm,
      padding: 11,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    fieldActive: { borderColor: colors.accent },
    icon: { fontSize: 14 },
    coords: {
      flex: 1,
      fontSize: 13,
      color: colors.accent,
      fontFamily: 'DM Mono',
    },
    badge: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.green,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      fontFamily: 'DM Sans',
    },
    loadingText: {
      fontSize: 14,
      color: colors.textMuted,
      fontFamily: 'DM Sans',
    },
    errorText: {
      flex: 1,
      fontSize: 13,
      color: colors.red,
      fontFamily: 'DM Sans',
    },
  });
}

export function LocationField({ latitude, longitude, onLocationCaptured }: LocationFieldProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (latitude !== null && longitude !== null) return;
    captureLocation();
  }, [latitude, longitude]);

  async function captureLocation() {
    setLoading(true);
    setError(null);
    const loc = await getCurrentLocation();
    setLoading(false);
    if (loc) {
      onLocationCaptured(loc.latitude, loc.longitude);
    } else {
      setError('Could not get GPS location. Check location permissions.');
    }
  }

  const hasLocation = latitude !== null && longitude !== null;

  return (
    <View style={styles.container}>
      <SectionLabel>
        Your location{' '}
        <Text style={styles.hint}>(auto-captured)</Text>
      </SectionLabel>

      <View style={[styles.field, hasLocation && styles.fieldActive]}>
        <Text style={styles.icon}>📍</Text>

        {loading ? (
          <>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={styles.loadingText}>Getting GPS fix…</Text>
          </>
        ) : hasLocation ? (
          <>
            <Text style={styles.coords}>
              {formatCoordinates(latitude!, longitude!)}
            </Text>
            <Text style={styles.badge}>GPS ✓</Text>
          </>
        ) : (
          <Text style={styles.errorText}>{error ?? 'Location unavailable'}</Text>
        )}
      </View>
    </View>
  );
}
