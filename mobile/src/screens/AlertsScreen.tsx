import React from 'react';
import {
  View, Text, StyleSheet, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Font, Radius } from '../theme';
import type { AlertLog } from '../types';

interface Props {
  alerts: AlertLog[];
}

const EVENT_META: Record<AlertLog['type'], { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  ANOMALY:           { label: 'AI 이상',       color: '#a855f7',      icon: 'analytics' },
  ANOMALY_GAS:       { label: 'AI 이상 - 가스', color: Colors.warning, icon: 'cloud'     },
  ANOMALY_FLAME:     { label: 'AI 이상 - 불꽃', color: Colors.danger,  icon: 'flame'     },
  ANOMALY_BOTH:      { label: 'AI 이상 - 복합', color: '#e74c3c',      icon: 'warning'   },
  ANOMALY_GAS_FLAME: { label: 'AI 이상 - 복합', color: '#e74c3c',      icon: 'warning'   },
};

function AlertItem({ item }: { item: AlertLog }) {
  const meta = EVENT_META[item.type] ?? { label: item.type, color: '#a855f7', icon: 'analytics' as const };
  const date = new Date(item.ts);
  const isValidDate = !isNaN(date.getTime());

  return (
    <View style={[styles.item, { borderLeftColor: meta.color }]}>
      <View style={[styles.iconWrap, { backgroundColor: meta.color + '22' }]}>
        <Ionicons name={meta.icon} size={22} color={meta.color} />
      </View>
      <View style={styles.itemInfo}>
        <View style={styles.itemTop}>
          <Text style={[styles.itemType, { color: meta.color }]}>{meta.label}</Text>
          <Text style={styles.itemTime}>
            {isValidDate
              ? `${date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} ${date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
              : item.ts}
          </Text>
        </View>
        <Text style={styles.itemDetail}>
          MQ-2: {item.mq2Ao} · 불꽃: {item.flameAo}
        </Text>
      </View>
    </View>
  );
}

export function AlertsScreen({ alerts }: Props) {
  const counts = alerts.reduce(
    (acc, a) => ({ ...acc, [a.type]: (acc[a.type] ?? 0) + 1 }),
    {} as Record<string, number>,
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>경고 이력</Text>
        <Text style={styles.sub}>총 {alerts.length}건</Text>
      </View>

      {/* 요약 칩 */}
      <View style={styles.summaryRow}>
        {(Object.keys(EVENT_META) as AlertLog['type'][]).map(type => {
          const meta = EVENT_META[type];
          const cnt  = counts[type] ?? 0;
          return (
            <View key={type} style={[styles.chip, { borderColor: meta.color + '55', backgroundColor: meta.color + '11' }]}>
              <Ionicons name={meta.icon} size={13} color={meta.color} />
              <Text style={[styles.chipText, { color: meta.color }]}>{cnt}</Text>
            </View>
          );
        })}
      </View>

      {alerts.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="checkmark-done-circle" size={52} color={Colors.success} />
          <Text style={styles.emptyText}>이력 없음</Text>
        </View>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <AlertItem item={item} />}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: Colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  title:  { fontSize: Font.xl, fontWeight: '800', color: Colors.textPrimary },
  sub:    { fontSize: Font.sm, color: Colors.textSecondary, marginTop: 2 },

  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.xl,
    borderWidth: 1,
  },
  chipText: { fontSize: Font.xs, fontWeight: '700' },

  list:  { paddingHorizontal: 20, paddingBottom: 32 },
  sep:   { height: 8 },

  item: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 3,
    padding: 14,
    gap: 12,
    alignItems: 'center',
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo:   { flex: 1 },
  itemTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemType:   { fontSize: Font.md, fontWeight: '700' },
  itemTime:   { fontSize: Font.xs, color: Colors.textSecondary },
  itemDetail: { fontSize: Font.sm, color: Colors.textSecondary, marginTop: 4 },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyText: { fontSize: Font.md, color: Colors.textSecondary },
});
