import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, TextInput, ScrollView, SafeAreaView, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { radius, spacing } from '@/constants/design';
import {
  SupplyType, PeopleCount, SupplyRequest, MedicalDetailsState,
  SUPPLY_TYPE_EMOJI, SUPPLY_TYPE_LABELS,
} from '@/types';
import { enqueue, saveDraft, clearDraft } from '@/services/messageQueue';
import { SupplyChips } from '@/components/request/SupplyChips';
import { PeopleCounter } from '@/components/request/PeopleCounter';
import { MedicalDetails } from '@/components/request/MedicalDetails';
import { LocationField } from '@/components/request/LocationField';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { useTheme } from '@/hooks/useTheme';
import { ThemeColors } from '@/constants/themes';

function generateId(): string {
  const hex = Math.random().toString(16).slice(2, 6).toUpperCase();
  return `HH:${hex}`;
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1 },
    header: { padding: spacing.lg, paddingBottom: 0 },
    title: {
      fontSize: 26,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.4,
      fontFamily: 'DM Sans',
    },
    form: { padding: spacing.lg, gap: spacing.lg },
    group: { gap: 6 },
    textarea: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.sm,
      padding: 11,
      fontSize: 15,
      color: colors.text,
      fontFamily: 'DM Sans',
      height: 80,
    },
    submitBtn: {
      marginHorizontal: spacing.lg,
      backgroundColor: colors.accent2,
      borderRadius: radius.sm,
      paddingVertical: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    submitBtnDisabled: { opacity: 0.6 },
    submitIcon: { fontSize: 16 },
    submitText: {
      fontSize: 16,
      fontWeight: '700',
      color: 'white',
      fontFamily: 'DM Sans',
    },
  });
}

function makeSummaryStyles(colors: ThemeColors) {
  return StyleSheet.create({
    box: {
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      padding: 12,
      gap: 6,
    },
    label: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      color: colors.textMuted,
      fontFamily: 'DM Sans',
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
    chip: {
      backgroundColor: colors.accentDim,
      borderWidth: 1,
      borderColor: colors.greenBorder,
      borderRadius: 20,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    chipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.accent,
      fontFamily: 'DM Sans',
    },
    chipRed: {
      backgroundColor: colors.redDim,
      borderWidth: 1,
      borderColor: colors.redBorder,
      borderRadius: 20,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    chipRedText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.red,
      fontFamily: 'DM Sans',
    },
    notes: {
      fontSize: 13,
      color: colors.textMuted,
      lineHeight: 19,
      fontFamily: 'DM Sans',
    },
  });
}

// ─── Summary Box ─────────────────────────────────────────────────────────────

interface SummaryBoxProps {
  supplyTypes: SupplyType[];
  people: PeopleCount;
  additionalInfo: string;
  hasLocation: boolean;
  medicalDetails?: MedicalDetailsState;
}

function SummaryBox({ supplyTypes, people, additionalInfo, hasLocation, medicalDetails }: SummaryBoxProps) {
  const { colors } = useTheme();
  const summaryStyles = useMemo(() => makeSummaryStyles(colors), [colors]);
  const totalPeople = people.adults + people.children + people.elderly;

  const hasMedicalFilled =
    medicalDetails !== undefined &&
    Object.values(medicalDetails).some(
      (d) => d !== null && (d.conditionType !== null || d.specificNeed.trim().length > 0)
    );

  return (
    <View style={summaryStyles.box}>
      <Text style={summaryStyles.label}>Review your request</Text>
      <View style={summaryStyles.chips}>
        {supplyTypes.map((t) => (
          <View key={t} style={summaryStyles.chip}>
            <Text style={summaryStyles.chipText}>
              {SUPPLY_TYPE_EMOJI[t]} {SUPPLY_TYPE_LABELS[t]}
              {t === 'medical' && hasMedicalFilled ? ' ✓' : ''}
            </Text>
          </View>
        ))}
        {totalPeople > 0 && (
          <View style={summaryStyles.chip}>
            <Text style={summaryStyles.chipText}>
              {totalPeople} {totalPeople === 1 ? 'person' : 'people'}
            </Text>
          </View>
        )}
        {hasLocation && (
          <View style={summaryStyles.chip}>
            <Text style={summaryStyles.chipText}>📍 Located</Text>
          </View>
        )}
      </View>
      {additionalInfo.trim().length > 0 && (
        <Text style={summaryStyles.notes} numberOfLines={2}>
          {additionalInfo.trim()}
        </Text>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RequestScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [supplyTypes, setSupplyTypes] = useState<SupplyType[]>([]);
  const [people, setPeople] = useState<PeopleCount>({ adults: 1, children: 0, elderly: 0 });
  const [medicalDetails, setMedicalDetails] = useState<MedicalDetailsState>({
    adults: null, children: null, elderly: null,
  });
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const autosaveDraft = useCallback(() => {
    saveDraft({ supplyTypes, people, additionalInfo, latitude, longitude });
  }, [supplyTypes, people, additionalInfo, latitude, longitude]);

  const showMedical = supplyTypes.includes('medical');
  const showAdditionalInfo = supplyTypes.includes('other');

  const showSummary = supplyTypes.length > 0;

  async function handleSubmit() {
    if (supplyTypes.length === 0) {
      Alert.alert('Missing info', 'Please select at least one supply type.');
      return;
    }

    setSubmitting(true);

    const now = Date.now();
    const request: SupplyRequest = {
      id: generateId(),
      createdAt: now,
      updatedAt: now,
      supplyTypes,
      people,
      medicalDetails: showMedical ? medicalDetails : undefined,
      additionalInfo,
      latitude,
      longitude,
      status: 'pending',
      retryCount: 0,
    };

    await enqueue(request);
    await clearDraft();

    setSupplyTypes([]);
    setPeople({ adults: 1, children: 0, elderly: 0 });
    setMedicalDetails({ adults: null, children: null, elderly: null });
    setAdditionalInfo('');
    setLatitude(null);
    setLongitude(null);

    setSubmitting(false);
    router.replace('/(tabs)');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>Supply Request</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.group}>
              <SupplyChips
                selected={supplyTypes}
                onChange={(v) => { setSupplyTypes(v); autosaveDraft(); }}
              />
            </View>

            <View style={styles.group}>
              <PeopleCounter
                value={people}
                onChange={(v) => { setPeople(v); autosaveDraft(); }}
              />
            </View>

            {showMedical && (
              <View style={styles.group}>
                <MedicalDetails
                  people={people}
                  value={medicalDetails}
                  onChange={setMedicalDetails}
                />
              </View>
            )}

            {showAdditionalInfo && (
              <View style={styles.group}>
                <SectionLabel>Additional information</SectionLabel>
                <TextInput
                  style={styles.textarea}
                  value={additionalInfo}
                  onChangeText={(v) => { setAdditionalInfo(v); autosaveDraft(); }}
                  placeholder="Describe the supplies you need..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>
            )}

            <View style={styles.group}>
              <LocationField
                latitude={latitude}
                longitude={longitude}
                onLocationCaptured={(lat, lon) => { setLatitude(lat); setLongitude(lon); autosaveDraft(); }}
              />
            </View>
          </View>

          {showSummary && (
            <SummaryBox
              supplyTypes={supplyTypes}
              people={people}
              additionalInfo={additionalInfo}
              hasLocation={latitude !== null && longitude !== null}
              medicalDetails={showMedical ? medicalDetails : undefined}
            />
          )}

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
          >
            <Text style={styles.submitIcon}>📡</Text>
            <Text style={styles.submitText}>
              {submitting ? 'Sending…' : 'Send via Mesh Network'}
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
