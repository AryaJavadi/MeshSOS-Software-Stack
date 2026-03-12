import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { radius, spacing } from '@/constants/design';
import { NodeInfo, GatewayMessage, SupplyRequest, GatewayMessageType, RequestStatus, SUPPLY_TYPE_EMOJI, SUPPLY_TYPE_LABELS } from '@/types';
import { NodeCard } from './NodeCard';
import { bleService } from '@/services/ble';
import { useMessageStore } from '@/store/messageStore';
import { useRequestStore } from '@/store/requestStore';
import { useTheme } from '@/hooks/useTheme';
import { ThemeColors } from '@/constants/themes';

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── Style factories ──────────────────────────────────────────────────────────

function makeMainStyles(colors: ThemeColors) {
  return StyleSheet.create({
    scroll: { flex: 1 },
    content: { gap: spacing.md, paddingBottom: spacing.xl },
    cta: {
      backgroundColor: colors.accent2,
      borderRadius: radius.md,
      padding: 18,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    ctaTitle: { fontSize: 16, fontWeight: '700', color: 'white', fontFamily: 'DM Sans' },
    ctaSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2, fontFamily: 'DM Sans' },
    ctaArrow: { fontSize: 22, color: 'rgba(255,255,255,0.8)' },
  });
}

function makeSecStyles(colors: ThemeColors) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    label: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      color: colors.textMuted,
      fontFamily: 'DM Sans',
    },
    unreadBadge: {
      backgroundColor: colors.red,
      borderRadius: 8,
      minWidth: 16,
      height: 16,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    unreadBadgeText: { fontSize: 10, fontWeight: '800', color: 'white', fontFamily: 'DM Mono' },
    link: { fontSize: 12, color: colors.accent, fontFamily: 'DM Sans', fontWeight: '600' },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      overflow: 'hidden',
    },
    empty: { padding: spacing.lg, alignItems: 'center' },
    emptyText: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      fontFamily: 'DM Sans',
      lineHeight: 20,
    },
  });
}

function makeRowStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: { flexDirection: 'row', alignItems: 'stretch' },
    border: { borderBottomWidth: 1, borderBottomColor: colors.border },
    bar: { width: 3, flexShrink: 0 },
    body: { flex: 1, padding: 10, gap: 4 },
    top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    badge: {
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 1.5,
    },
    badgeText: {
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      fontFamily: 'DM Sans',
    },
    time: { fontSize: 11, color: colors.textMuted, fontFamily: 'DM Mono', flexShrink: 0 },
    text: { fontSize: 14, color: colors.text, lineHeight: 20, fontFamily: 'DM Sans' },
    sub: { fontSize: 11, color: colors.textMuted, fontFamily: 'DM Mono' },
    unreadDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: colors.accent,
      marginTop: 12,
      marginRight: 10,
      flexShrink: 0,
    },
    supplyChips: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
    supplyEmoji: { fontSize: 14 },
    peopleText: { fontSize: 12, color: colors.textMuted, fontFamily: 'DM Sans' },
    chevron: { fontSize: 12, color: colors.textMuted, fontFamily: 'DM Mono' },
  });
}

function makeExpStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { paddingHorizontal: 10, paddingBottom: 10, gap: 10 },
    section: { gap: 4 },
    sectionLabel: {
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      color: colors.textMuted,
      fontFamily: 'DM Sans',
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    chip: {
      backgroundColor: colors.surface2,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    chipText: { fontSize: 12, color: colors.text, fontFamily: 'DM Sans' },
    row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    stat: { fontSize: 13, color: colors.text, fontFamily: 'DM Sans' },
    notes: { fontSize: 13, color: colors.text, fontFamily: 'DM Sans', lineHeight: 19 },
    mono: { fontSize: 12, color: colors.text, fontFamily: 'DM Mono' },
    timeline: { flexDirection: 'row', alignItems: 'flex-start', gap: 0 },
    timelineStep: { alignItems: 'center', gap: 3, flex: 1 },
    timelineLineWrap: { flexDirection: 'row', alignItems: 'center', flex: 1, marginTop: 5 },
    timelineSpinner: { transform: [{ scale: 0.55 }], marginHorizontal: 2 },
    timelineLine: { height: 1, flex: 1, backgroundColor: colors.border },
    timelineDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.surface2,
      borderWidth: 1,
      borderColor: colors.border,
    },
    timelineDotDone: { backgroundColor: colors.textMuted, borderColor: colors.textMuted },
    timelineDotReceived: { backgroundColor: colors.green, borderColor: colors.green },
    timelineLabel: {
      fontSize: 10,
      color: colors.textMuted,
      fontFamily: 'DM Sans',
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    timelineLabelDone: { color: colors.text },
    timelineLabelReceived: { color: colors.green },
    timelineSub: { fontSize: 10, color: colors.textMuted, fontFamily: 'DM Mono' },
  });
}

// ─── From Responders ──────────────────────────────────────────────────────────

function MessageRow({ msg, isLast }: { msg: GatewayMessage; isLast: boolean }) {
  const { colors } = useTheme();
  const row = useMemo(() => makeRowStyles(colors), [colors]);

  const color  = msg.type === 'urgent' ? colors.red    : msg.type === 'action' ? colors.yellow    : colors.blue;
  const dim    = msg.type === 'urgent' ? colors.redDim : msg.type === 'action' ? colors.yellowDim : colors.blueDim;
  const border = msg.type === 'urgent' ? colors.redBorder : msg.type === 'action' ? colors.yellowBorder : colors.blueBorder;
  const label  = msg.type === 'urgent' ? 'Urgent' : msg.type === 'action' ? 'Action' : 'Info';

  return (
    <View style={[row.wrap, !isLast && row.border]}>
      <View style={[row.bar, { backgroundColor: color }]} />
      <View style={row.body}>
        <View style={row.top}>
          <View style={[row.badge, { backgroundColor: dim, borderColor: border }]}>
            <Text style={[row.badgeText, { color }]}>{label}</Text>
          </View>
          <Text style={row.time}>{formatTime(msg.timestamp)}</Text>
        </View>
        <Text style={row.text} numberOfLines={2}>{msg.content}</Text>
        <Text style={row.sub}>via {msg.fromNodeId}</Text>
      </View>
      {!msg.read && <View style={row.unreadDot} />}
    </View>
  );
}

function RespondersSection() {
  const { colors } = useTheme();
  const sec = useMemo(() => makeSecStyles(colors), [colors]);
  const { messages, unreadCount } = useMessageStore();
  const router = useRouter();
  const recent = messages.slice(0, 3);

  return (
    <View>
      <View style={sec.header}>
        <View style={sec.headerLeft}>
          <Text style={sec.label}>Incoming Messages</Text>
          {unreadCount > 0 && (
            <View style={sec.unreadBadge}>
              <Text style={sec.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={() => router.push('/(tabs)/status')}>
          <Text style={sec.link}>See all →</Text>
        </TouchableOpacity>
      </View>

      <View style={sec.card}>
        {recent.length === 0 ? (
          <View style={sec.empty}>
            <Text style={sec.emptyText}>No messages yet. Waiting for responders.</Text>
          </View>
        ) : (
          recent.map((msg, i) => (
            <MessageRow key={msg.id} msg={msg} isLast={i === recent.length - 1} />
          ))
        )}
      </View>
    </View>
  );
}

// ─── Sent Requests ────────────────────────────────────────────────────────────

function RequestRow({ req, isLast, expanded, onToggle }: {
  req: SupplyRequest;
  isLast: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { colors } = useTheme();
  const row = useMemo(() => makeRowStyles(colors), [colors]);
  const exp = useMemo(() => makeExpStyles(colors), [colors]);

  const STATUS_COLOR: Record<RequestStatus, string> = {
    draft: colors.textMuted, pending: colors.textMuted, sent: colors.textMuted,
    relayed: colors.yellow, received: colors.green, failed: colors.red,
  };
  const STATUS_DIM: Record<RequestStatus, string> = {
    draft: 'rgba(125,135,144,0.12)', pending: 'rgba(125,135,144,0.12)', sent: 'rgba(125,135,144,0.12)',
    relayed: colors.yellowDim, received: colors.greenDim, failed: colors.redDim,
  };
  const STATUS_LABEL: Record<RequestStatus, string> = {
    draft: 'Draft', pending: 'Pending', sent: 'Sent',
    relayed: 'Relayed', received: 'Received ✓', failed: 'Failed',
  };

  const color = STATUS_COLOR[req.status];
  const dim   = STATUS_DIM[req.status];
  const total = req.people.adults + req.people.children + req.people.elderly;

  return (
    <View style={[row.wrap, !isLast && !expanded && row.border]}>
      <View style={[row.bar, { backgroundColor: colors.accent, opacity: 0.4 }]} />
      <View style={{ flex: 1 }}>
        <TouchableOpacity activeOpacity={0.7} onPress={onToggle}>
          <View style={row.body}>
            <View style={row.top}>
              <View style={row.supplyChips}>
                {req.supplyTypes.map((t) => (
                  <Text key={t} style={row.supplyEmoji}>{SUPPLY_TYPE_EMOJI[t]}</Text>
                ))}
                <Text style={row.peopleText}>
                  {total} {total === 1 ? 'person' : 'people'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={row.time}>{formatTime(req.createdAt)}</Text>
                <Text style={row.chevron}>{expanded ? '∧' : '∨'}</Text>
              </View>
            </View>
            <View style={[row.badge, { backgroundColor: dim, borderColor: `${color}33` }]}>
              <Text style={[row.badgeText, { color }]}>{STATUS_LABEL[req.status]}</Text>
            </View>
          </View>
        </TouchableOpacity>

        {expanded && (
          <View style={[exp.container, !isLast && row.border]}>
            <View style={exp.section}>
              <Text style={exp.sectionLabel}>Supplies Requested</Text>
              <View style={exp.chipRow}>
                {req.supplyTypes.map((t) => (
                  <View key={t} style={exp.chip}>
                    <Text style={exp.chipText}>{SUPPLY_TYPE_EMOJI[t]} {SUPPLY_TYPE_LABELS[t]}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={exp.section}>
              <Text style={exp.sectionLabel}>People</Text>
              <View style={exp.row}>
                {req.people.adults > 0 && (
                  <Text style={exp.stat}>{req.people.adults} infant{req.people.adults !== 1 ? 's' : ''}</Text>
                )}
                {req.people.children > 0 && (
                  <Text style={exp.stat}>{req.people.children} {req.people.children !== 1 ? 'children/adults' : 'child/adult'}</Text>
                )}
                {req.people.elderly > 0 && (
                  <Text style={exp.stat}>{req.people.elderly} senior{req.people.elderly !== 1 ? 's' : ''}</Text>
                )}
              </View>
            </View>

            {req.medicalDetails && (
              (['adults', 'children', 'elderly'] as const).some(
                (tier) => req.medicalDetails![tier]?.specificNeed?.trim()
              )
            ) && (
              <View style={exp.section}>
                <Text style={exp.sectionLabel}>Additional Information</Text>
                {(['adults', 'children', 'elderly'] as const).map((tier) => {
                  const need = req.medicalDetails![tier]?.specificNeed?.trim();
                  if (!need) return null;
                  const label = tier === 'adults' ? 'Infant (0–2)' : tier === 'children' ? 'Child/Adult (3–59)' : 'Senior (60+)';
                  return <Text key={tier} style={exp.notes}>{label}: {need}</Text>;
                })}
              </View>
            )}

            {req.additionalInfo.trim().length > 0 && (
              <View style={exp.section}>
                <Text style={exp.sectionLabel}>Additional Information</Text>
                <Text style={exp.notes}>{req.additionalInfo.trim()}</Text>
              </View>
            )}

            {req.latitude != null && req.longitude != null && (
              <View style={exp.section}>
                <Text style={exp.sectionLabel}>Location</Text>
                <Text style={exp.mono}>
                  {req.latitude.toFixed(5)}, {req.longitude.toFixed(5)}
                </Text>
              </View>
            )}

            <View style={exp.section}>
              <Text style={exp.sectionLabel}>Delivery</Text>
              <View style={exp.timeline}>
                <View style={exp.timelineStep}>
                  <View style={[exp.timelineDot, req.sentAt ? exp.timelineDotDone : {}]} />
                  <Text style={[exp.timelineLabel, req.sentAt ? exp.timelineLabelDone : {}]}>Sent</Text>
                  {req.sentAt ? <Text style={exp.timelineSub}>{formatTime(req.sentAt)}</Text> : null}
                </View>
                <View style={exp.timelineLineWrap}>
                  <View style={exp.timelineLine} />
                  {req.sentAt && !req.receivedAt ? (
                    <ActivityIndicator size="small" color={colors.accent} style={exp.timelineSpinner} />
                  ) : null}
                  <View style={exp.timelineLine} />
                </View>
                <View style={exp.timelineStep}>
                  <View style={[exp.timelineDot, req.receivedAt ? exp.timelineDotReceived : {}]} />
                  <Text style={[exp.timelineLabel, req.receivedAt ? exp.timelineLabelReceived : {}]}>Received</Text>
                  {req.receivedAt ? <Text style={exp.timelineSub}>{formatTime(req.receivedAt)}</Text> : null}
                </View>
              </View>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

function SentRequestsSection() {
  const { colors } = useTheme();
  const sec = useMemo(() => makeSecStyles(colors), [colors]);
  const { requests } = useRequestStore();
  const router = useRouter();
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  if (requests.length === 0) return null;

  const recent = [...requests].sort((a, b) => b.createdAt - a.createdAt).slice(0, 3);

  return (
    <View>
      <View style={sec.header}>
        <Text style={sec.label}>Sent Requests</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/request')}>
          <Text style={sec.link}>New →</Text>
        </TouchableOpacity>
      </View>

      <View style={sec.card}>
        {recent.map((req, i) => (
          <RequestRow
            key={req.id}
            req={req}
            isLast={i === recent.length - 1}
            expanded={expandedId === req.id}
            onToggle={() => setExpandedId(expandedId === req.id ? null : req.id)}
          />
        ))}
      </View>
    </View>
  );
}

// ─── ConnectedState ───────────────────────────────────────────────────────────

interface ConnectedStateProps {
  node: NodeInfo;
}

export function ConnectedState({ node }: ConnectedStateProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeMainStyles(colors), [colors]);
  const router = useRouter();

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <NodeCard node={node} onReplace={() => bleService.disconnect()} />

      <SentRequestsSection />

      <TouchableOpacity
        style={styles.cta}
        activeOpacity={0.85}
        onPress={() => router.push('/(tabs)/request')}
      >
        <View>
          <Text style={styles.ctaTitle}>Send Supply Request</Text>
          <Text style={styles.ctaSub}>Reach emergency responders now</Text>
        </View>
        <Text style={styles.ctaArrow}>→</Text>
      </TouchableOpacity>

      <RespondersSection />
    </ScrollView>
  );
}
