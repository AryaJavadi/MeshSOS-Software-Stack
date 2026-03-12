import React, { useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet,
} from 'react-native';
import { radius } from '@/constants/design';
import { MedicalConditionType, MedicalDetail, MedicalDetailsState } from '@/types';
import { PeopleCount } from '@/types';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { useTheme } from '@/hooks/useTheme';
import { ThemeColors } from '@/constants/themes';

const CONDITION_TYPES: { key: MedicalConditionType; label: string }[] = [
  { key: 'injury',     label: 'Injury' },
  { key: 'chronic',    label: 'Chronic' },
  { key: 'disability', label: 'Disability' },
  { key: 'medication', label: 'Medication' },
  { key: 'mental',     label: 'Mental' },
  { key: 'other',      label: 'Other' },
];

const TIER_META: Record<keyof MedicalDetailsState, { label: string; sub: string }> = {
  adults:   { label: 'Infant',      sub: '(0–2)' },
  children: { label: 'Child/Adult', sub: '(3–59)' },
  elderly:  { label: 'Senior',      sub: '(60+)' },
};

interface MedicalDetailsProps {
  people: PeopleCount;
  value: MedicalDetailsState;
  onChange: (v: MedicalDetailsState) => void;
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { gap: 8 },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      gap: 10,
    },
    headerIcon: { fontSize: 16 },
    headerInfo: { flex: 1 },
    tierLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
      fontFamily: 'DM Sans',
    },
    tierSub: {
      fontSize: 11,
      color: colors.textMuted,
      fontFamily: 'DM Sans',
    },
    addHint: {
      fontSize: 12,
      color: colors.textMuted,
      fontFamily: 'DM Sans',
      fontStyle: 'italic',
      marginTop: 2,
    },
    filledRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 5,
      marginTop: 3,
    },
    conditionChip: {
      backgroundColor: colors.accentDim,
      borderWidth: 1,
      borderColor: colors.greenBorder,
      borderRadius: 10,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    conditionChipText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.accent,
      fontFamily: 'DM Sans',
    },
    previewText: {
      fontSize: 11,
      color: colors.textMuted,
      fontFamily: 'DM Sans',
      fontStyle: 'italic',
      flexShrink: 1,
    },
    dismissBtn: {
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    dismissBtnText: {
      fontSize: 18,
      color: colors.textMuted,
      lineHeight: 20,
    },
    chevron: {
      fontSize: 18,
      color: colors.textMuted,
    },
    // Dismissed state
    dismissedCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      gap: 10,
    },
    dismissedIcon: { fontSize: 14, opacity: 0.35 },
    dismissedText: {
      flex: 1,
      fontSize: 12,
      color: colors.textMuted,
      fontFamily: 'DM Sans',
      fontStyle: 'italic',
    },
    addBackBtn: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
    },
    addBackBtnText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.accent,
      fontFamily: 'DM Sans',
    },
    // Expanded body
    expanded: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      padding: 12,
      gap: 14,
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      color: colors.textMuted,
      fontFamily: 'DM Sans',
      marginBottom: 7,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    chipOption: {
      borderWidth: 1,
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    chipOptionText: {
      fontSize: 12,
      fontWeight: '600',
      fontFamily: 'DM Sans',
    },
    needInput: {
      backgroundColor: colors.bg,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      padding: 10,
      fontSize: 14,
      color: colors.text,
      fontFamily: 'DM Sans',
      minHeight: 64,
    },
    charCount: {
      fontSize: 10,
      color: colors.textMuted,
      fontFamily: 'DM Mono',
      textAlign: 'right',
      marginTop: 3,
    },
  });
}

export function MedicalDetails({ people, value, onChange }: MedicalDetailsProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [expandedTier, setExpandedTier] = useState<keyof MedicalDetailsState | null>(null);
  const [dismissedTiers, setDismissedTiers] = useState<Set<keyof MedicalDetailsState>>(new Set());

  const activeTiers = (
    ['adults', 'children', 'elderly'] as (keyof MedicalDetailsState)[]
  ).filter((tier) => people[tier] > 0);

  if (activeTiers.length === 0) return null;

  const totalPeople = people.adults + people.children + people.elderly;
  const canDismiss = totalPeople > 1;

  function updateDetail(tier: keyof MedicalDetailsState, patch: Partial<MedicalDetail>) {
    const current: MedicalDetail = value[tier] ?? { conditionType: null, specificNeed: '' };
    onChange({ ...value, [tier]: { ...current, ...patch } });
  }

  function dismissTier(tier: keyof MedicalDetailsState) {
    setDismissedTiers((prev) => new Set([...prev, tier]));
    onChange({ ...value, [tier]: null });
    if (expandedTier === tier) setExpandedTier(null);
  }

  function restoreTier(tier: keyof MedicalDetailsState) {
    setDismissedTiers((prev) => {
      const next = new Set(prev);
      next.delete(tier);
      return next;
    });
  }

  return (
    <View style={styles.container}>
      <SectionLabel>Medical Details</SectionLabel>

      {activeTiers.map((tier) => {
        const detail = value[tier];
        const meta = TIER_META[tier];
        const isExpanded = expandedTier === tier;
        const isDismissed = dismissedTiers.has(tier);
        const isFilled =
          detail !== null &&
          (detail.conditionType !== null || detail.specificNeed.trim().length > 0);

        // ── Dismissed row ──────────────────────────────────────────────
        if (isDismissed) {
          return (
            <View key={tier} style={styles.dismissedCard}>
              <Text style={styles.dismissedIcon}>🩹</Text>
              <Text style={styles.dismissedText}>
                {meta.label} — no medical needs
              </Text>
              <TouchableOpacity
                style={styles.addBackBtn}
                onPress={() => restoreTier(tier)}
                activeOpacity={0.7}
              >
                <Text style={styles.addBackBtnText}>+ Add</Text>
              </TouchableOpacity>
            </View>
          );
        }

        // ── Active card ────────────────────────────────────────────────
        return (
          <View key={tier} style={styles.card}>
            <TouchableOpacity
              style={styles.header}
              onPress={() => setExpandedTier(isExpanded ? null : tier)}
              activeOpacity={0.7}
            >
              <Text style={styles.headerIcon}>🩹</Text>
              <View style={styles.headerInfo}>
                <Text style={styles.tierLabel}>
                  {meta.label}{' '}
                  <Text style={styles.tierSub}>{meta.sub}</Text>
                </Text>
                {isFilled ? (
                  <View style={styles.filledRow}>
                    {detail!.conditionType !== null && (
                      <View style={styles.conditionChip}>
                        <Text style={styles.conditionChipText}>
                          {CONDITION_TYPES.find((c) => c.key === detail!.conditionType)?.label}
                        </Text>
                      </View>
                    )}
                    {detail!.specificNeed.trim().length > 0 && (
                      <Text style={styles.previewText} numberOfLines={1}>
                        {detail!.specificNeed.trim()}
                      </Text>
                    )}
                  </View>
                ) : (
                  <Text style={styles.addHint}>+ Add medical info</Text>
                )}
              </View>

              {/* Dismiss button — only when multiple people selected */}
              {canDismiss && (
                <TouchableOpacity
                  style={styles.dismissBtn}
                  onPress={() => dismissTier(tier)}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                >
                  <Text style={styles.dismissBtnText}>×</Text>
                </TouchableOpacity>
              )}

              <Text style={styles.chevron}>{isExpanded ? '∨' : '›'}</Text>
            </TouchableOpacity>

            {/* Expanded body */}
            {isExpanded && (
              <View style={styles.expanded}>
                {/* Condition type chips */}
                <View>
                  <Text style={styles.sectionLabel}>Condition type</Text>
                  <View style={styles.chipRow}>
                    {CONDITION_TYPES.map((c) => {
                      const selected = detail?.conditionType === c.key;
                      return (
                        <TouchableOpacity
                          key={c.key}
                          style={[
                            styles.chipOption,
                            {
                              backgroundColor: selected ? colors.accentDim : colors.bg,
                              borderColor: selected ? colors.greenBorder : colors.border,
                            },
                          ]}
                          onPress={() =>
                            updateDetail(tier, { conditionType: selected ? null : c.key })
                          }
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.chipOptionText,
                              { color: selected ? colors.accent : colors.textMuted },
                            ]}
                          >
                            {c.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Specific need */}
                <View>
                  <Text style={styles.sectionLabel}>Additional Information</Text>
                  <TextInput
                    style={styles.needInput}
                    value={detail?.specificNeed ?? ''}
                    onChangeText={(t) => updateDetail(tier, { specificNeed: t.slice(0, 100) })}
                    placeholder="Describe condition and essential needs..."
                    placeholderTextColor={colors.textMuted}
                    multiline
                    textAlignVertical="top"
                    maxLength={100}
                  />
                  <Text style={styles.charCount}>
                    {(detail?.specificNeed ?? '').length}/100
                  </Text>
                </View>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}